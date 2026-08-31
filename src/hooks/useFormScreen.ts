import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {getAccounts, getCategories, IAccountWithBalance, insertFinance} from '@db/queries';
import {parseAmountToCents} from '@utils/currency';

export type CategoriesStatus = 'loading' | 'success' | 'error';
export type AccountsStatus = 'loading' | 'success' | 'error';
export type TransactionType = 'expense' | 'income';

// Re-exported for backward compatibility — this used to be defined here;
// it now lives in `@utils/currency` alongside `formatCentsToCurrency`
// and `parseInitialBalanceToCents` (the account-creation equivalent),
// since money parsing/formatting isn't specific to this one screen.
export {parseAmountToCents};

export const useFormScreen = () => {
  const {t} = useTranslation();
  const [inputText, onChangeInputText] = useState<string>('');

  // The Gasto/Ingreso segment from the approved prototype — new in
  // this pass. Transaction type used to be derived silently from
  // whichever category the user tapped (categories mix both types in
  // one flat list); now the segment is the primary choice and the
  // category grid is filtered to match it. See `selectType` for what
  // happens to `selectedCategory` when this changes.
  const [selectedType, setSelectedType] = useState<TransactionType>('expense');

  const [selectedCategory, onChangeSelectedCategory] = useState<ICategory>();

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [categoriesStatus, setCategoriesStatus] =
    useState<CategoriesStatus>('loading');
  const [categoriesErrorMessage, setCategoriesErrorMessage] =
    useState<string>('');

  // Every transaction belongs to an account (`insertFinance` requires
  // `idAccount` — see `src/db/queries/financesQueries.ts`). The account
  // is picked from the amount card, per the approved prototype: this
  // loads every active account and defaults the selection to the
  // first one, but the user can change it via `selectAccount` before
  // saving.
  const [accounts, setAccounts] = useState<IAccountWithBalance[]>([]);
  const [accountsStatus, setAccountsStatus] = useState<AccountsStatus>('loading');
  const [accountsErrorMessage, setAccountsErrorMessage] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<IAccountWithBalance>();

  const [amountError, setAmountError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadCategories = useCallback(async () => {
    setCategoriesStatus('loading');
    setCategoriesErrorMessage('');
    try {
      const db = await getDbConnection();
      const result = await getCategories(db);
      setCategories(result);
      setCategoriesStatus('success');
    } catch (e: any) {
      setCategoriesErrorMessage(
        t('form.loadCategoriesError', {message: e?.message ?? t('common.unknownError')}),
      );
      setCategoriesStatus('error');
    }
  }, [t]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const loadAccounts = useCallback(async () => {
    setAccountsStatus('loading');
    setAccountsErrorMessage('');
    try {
      const db = await getDbConnection();
      const result = await getAccounts(db);
      setAccounts(result);
      setSelectedAccount(prev => {
        if (prev && result.some(account => account.id === prev.id)) {
          return prev;
        }
        // Por defecto, la cuenta de efectivo: es el caso comun al anotar un
        // gasto sobre la marcha. `getAccounts` ordena por nombre, asi que
        // tomar la primera daba "Banco" antes que "Efectivo" por puro
        // alfabeto. Se elige por `kind`, no por nombre, para que siga
        // funcionando si el usuario la renombra o cambia de idioma.
        return result.find(account => account.kind === 'cash') ?? result[0];
      });
      setAccountsStatus('success');
    } catch (e: any) {
      setAccountsErrorMessage(
        t('form.loadAccountsError', {message: e?.message ?? t('common.unknownError')}),
      );
      setAccountsStatus('error');
    }
  }, [t]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const selectAccount = (account: IAccountWithBalance) => {
    setSelectedAccount(account);
  };

  // Only categories matching the active segment are ever shown in the
  // grid, so `selectedCategory` — once one is chosen — always belongs
  // to `selectedType` by construction. `selectType` still explicitly
  // clears it on a type switch (rather than relying on the grid
  // filter alone) so a stale cross-type selection can never survive
  // in state even for a single render.
  const filteredCategories = useMemo(
    () => categories.filter(category => category.type === selectedType),
    [categories, selectedType],
  );

  const selectType = (type: TransactionType) => {
    setSelectedType(type);
    onChangeSelectedCategory(undefined);
    setAmountError('');
  };

  const selectCategory = (category: ICategory) => {
    setAmountError('');
    onChangeSelectedCategory(category);
  };

  const saveTransaction = async (): Promise<boolean> => {
    if (!selectedCategory) {
      setAmountError(t('form.chooseCategoryFirst'));
      return false;
    }
    const amountInCents = parseAmountToCents(inputText);
    if (amountInCents === null) {
      setAmountError(t('form.invalidAmount'));
      return false;
    }
    if (!selectedAccount) {
      setAmountError(t('form.chooseAccountFirst'));
      return false;
    }
    setAmountError('');
    setIsSaving(true);
    try {
      const db = await getDbConnection();
      await insertFinance(db, {
        amount: amountInCents,
        idCategory: selectedCategory.id,
        idAccount: selectedAccount.id,
      });
      // Sin dialogo de confirmacion: el usuario ve el movimiento aparecer
      // en Balance, que es prueba mas fuerte que un aviso que hay que cerrar.
      onChangeInputText('');
      onChangeSelectedCategory(undefined);
      return true;
    } catch (e: any) {
      setAmountError(
        t('form.saveTransactionError', {message: e?.message ?? t('common.unknownError')}),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    inputText,
    onChangeInputText,
    selectedType,
    selectType,
    selectedCategory,
    selectCategory,
    // Unfiltered — drives the "are there ANY categories at all" empty
    // state (`categories.length === 0`), which is a different question
    // from "does the ACTIVE segment have any" (`filteredCategories`,
    // what the grid itself renders).
    categories,
    filteredCategories,
    categoriesStatus,
    categoriesErrorMessage,
    reloadCategories: loadCategories,
    accounts,
    accountsStatus,
    accountsErrorMessage,
    reloadAccounts: loadAccounts,
    selectedAccount,
    selectAccount,
    amountError,
    isSaving,
    saveTransaction,
  };
};
