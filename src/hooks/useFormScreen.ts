import {useCallback, useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {getAccounts, getCategories, IAccountWithBalance, insertFinance} from '@db/queries';
import {parseAmountToCents} from '@utils/currency';

export type CategoriesStatus = 'loading' | 'success' | 'error';
export type AccountsStatus = 'loading' | 'success' | 'error';

// Re-exported for backward compatibility — this used to be defined here;
// it now lives in `@utils/currency` alongside `formatCentsToCurrency`
// and `parseInitialBalanceToCents` (the account-creation equivalent),
// since money parsing/formatting isn't specific to this one screen.
export {parseAmountToCents};

export const useFormScreen = () => {
  const {t} = useTranslation();
  const [inputText, onChangeInputText] = useState<string>('');

  const [visibleInputText, setVisibleInputText] = useState<boolean>(false);

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
        return result[0];
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

  const selectCategory = (category: ICategory) => {
    setVisibleInputText(true);
    onChangeInputText('');
    setAmountError('');
    onChangeSelectedCategory(category);
  };

  const saveTransaction = async () => {
    if (!selectedCategory) {
      setAmountError(t('form.chooseCategoryFirst'));
      return;
    }
    const amountInCents = parseAmountToCents(inputText);
    if (amountInCents === null) {
      setAmountError(t('form.invalidAmount'));
      return;
    }
    if (!selectedAccount) {
      setAmountError(t('form.chooseAccountFirst'));
      return;
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
      Alert.alert(
        t('common.success'),
        t('form.transactionSaved'),
        [{text: t('common.ok')}],
        {cancelable: false},
      );
      onChangeInputText('');
      setVisibleInputText(false);
      onChangeSelectedCategory(undefined);
    } catch (e: any) {
      setAmountError(
        t('form.saveTransactionError', {message: e?.message ?? t('common.unknownError')}),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return {
    inputText,
    onChangeInputText,
    visibleInputText,
    setVisibleInputText,
    selectedCategory,
    selectCategory,
    categories,
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
