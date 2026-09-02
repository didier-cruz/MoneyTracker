import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {
  getAccounts,
  getCategories,
  getFinanceById,
  IAccountWithBalance,
  insertFinance,
  updateFinance,
} from '@db/queries';
import {formatCentsToCurrency} from '@utils/currency';
import {parseAmountToCents} from '@utils/currency';

export type CategoriesStatus = 'loading' | 'success' | 'error';
export type FormMode = 'create' | 'edit';
export type FinanceLoadStatus = 'idle' | 'loading' | 'success' | 'error';
export type AccountsStatus = 'loading' | 'success' | 'error';
export type TransactionType = 'expense' | 'income';

// Re-exported for backward compatibility — this used to be defined here;
// it now lives in `@utils/currency` alongside `formatCentsToCurrency`
// and `parseInitialBalanceToCents` (the account-creation equivalent),
// since money parsing/formatting isn't specific to this one screen.
export {parseAmountToCents};

/**
 * Estado del formulario de movimiento, para crear Y para editar.
 *
 * Con `financeId` entra en modo edicion: precarga importe, tipo,
 * categoria y cuenta del movimiento, y al guardar llama a
 * `updateFinance` en vez de `insertFinance`.
 *
 * Una PATA DE TRANSFERENCIA no se puede editar aqui —ver
 * `updateFinance`—, asi que el modo edicion la rechaza al cargarla en
 * vez de dejar al usuario rellenar un formulario que va a fallar al
 * guardar.
 */
export const useFormScreen = (financeId?: number) => {
  const mode: FormMode = financeId === undefined ? 'create' : 'edit';
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

  const [financeStatus, setFinanceStatus] = useState<FinanceLoadStatus>(
    financeId === undefined ? 'success' : 'loading',
  );
  const [financeErrorMessage, setFinanceErrorMessage] = useState<string>('');

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

  // Al RECUPERAR EL FOCO, no solo al montar: desde este formulario se
  // puede ir a crear una categoria ("Mas categorias") y al volver la
  // nueva tiene que estar en la grilla. Con un `useEffect` normal la
  // pantalla sigue montada mientras el usuario esta en el formulario de
  // categorias, asi que no se recargaba nada y la categoria recien
  // creada no aparecia. Es el mismo `useFocusEffect` que ya usan
  // Balance, Cuentas, Categorias y Analisis; este hook era el unico que
  // se habia quedado con `useEffect`.
  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [loadCategories]),
  );

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

  // Idem con las cuentas: crear una cuenta desde otra pantalla y volver
  // aqui tiene que ofrecerla como origen del movimiento.
  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts]),
  );

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

  /**
   * Precarga el movimiento en modo edicion. Depende de `categories` y
   * `accounts` porque el formulario trabaja con los OBJETOS
   * seleccionados, no con ids: hay que resolver la categoria y la
   * cuenta del movimiento contra las listas ya cargadas para que la
   * grilla y los chips los marquen.
   */
  /**
   * Ids de movimiento ya precargados. Sin esto, la recarga de
   * categorias al recuperar el foco volvia a disparar `loadFinance`
   * —depende de `categoriesStatus`— y sobreescribia lo que el usuario
   * estuviera editando: ir a crear una categoria a mitad de una
   * edicion y volver le borraba el importe que acababa de teclear.
   * Precargar es una operacion de UNA vez por movimiento.
   */
  const loadedFinanceIdRef = useRef<number | undefined>(undefined);

  const loadFinance = useCallback(async () => {
    if (financeId === undefined) {
      return;
    }
    if (categoriesStatus !== 'success' || accountsStatus !== 'success') {
      return;
    }
    if (loadedFinanceIdRef.current === financeId) {
      return;
    }
    setFinanceStatus('loading');
    setFinanceErrorMessage('');
    try {
      const db = await getDbConnection();
      const row = await getFinanceById(db, financeId);
      if (!row) {
        setFinanceErrorMessage(t('form.transactionNotFound'));
        setFinanceStatus('error');
        return;
      }
      if (row.transferGroupId !== null) {
        setFinanceErrorMessage(t('form.transferNotEditable'));
        setFinanceStatus('error');
        return;
      }
      // El importe se muestra como MAGNITUD: el signo lo lleva el tipo,
      // igual que al crear.
      onChangeInputText(
        formatCentsToCurrency(Math.abs(row.amount)).replace(/[$,]/g, ''),
      );
      if (row.category) {
        setSelectedType(row.category.type === 'income' ? 'income' : 'expense');
        onChangeSelectedCategory(
          categories.find(category => category.id === row.category?.id) ??
            row.category,
        );
      }
      const account = accounts.find(item => item.id === row.account.id);
      if (account) {
        setSelectedAccount(account);
      }
      loadedFinanceIdRef.current = financeId;
      setFinanceStatus('success');
    } catch (e: any) {
      setFinanceErrorMessage(
        t('form.loadTransactionError', {
          message: e?.message ?? t('common.unknownError'),
        }),
      );
      setFinanceStatus('error');
    }
  }, [financeId, categoriesStatus, accountsStatus, categories, accounts, t]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

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
      if (mode === 'edit' && financeId !== undefined) {
        await updateFinance(db, financeId, {
          amount: amountInCents,
          idCategory: selectedCategory.id,
          idAccount: selectedAccount.id,
        });
        // Al editar NO se limpia el formulario: la pantalla vuelve atras
        // y limpiar dejaria ver los campos vaciarse durante la
        // transicion.
        return true;
      }
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
    mode,
    financeStatus,
    financeErrorMessage,
    reloadFinance: () => {
      loadedFinanceIdRef.current = undefined;
      return loadFinance();
    },
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
