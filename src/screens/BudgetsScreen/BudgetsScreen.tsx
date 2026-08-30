import {useState} from 'react';
import {Alert, RefreshControl} from 'react-native';
import {useTranslation} from 'react-i18next';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {BudgetsNavParams} from '@navigation/[budgets]/BudgetsNavigator/types';
import {ICategoryBudgetWithSpent, IEnvelopeWithBalance} from '@db/queries';
import {colors, accent} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useBudgetsScreen} from '@hooks/useBudgetsScreen';
import {getMonthLabel} from './mappers';
import {EnvelopesSection} from './partials/EnvelopesSection/EnvelopesSection';
import {CategoryLimitsSection} from './partials/CategoryLimitsSection/CategoryLimitsSection';
import {
  AssignWithdrawModal,
  AssignWithdrawMode,
} from './partials/AssignWithdrawModal/AssignWithdrawModal';
import {
  CategoryLimitModal,
  CategoryLimitModalMode,
} from './partials/CategoryLimitModal/CategoryLimitModal';

interface BudgetsScreenProps
  extends NativeStackScreenProps<BudgetsNavParams, 'Budgets'> {}

interface AssignWithdrawSheetState {
  visible: boolean;
  mode: AssignWithdrawMode;
  envelope: IEnvelopeWithBalance | null;
}

interface CategoryLimitSheetState {
  visible: boolean;
  mode: CategoryLimitModalMode;
  budget: ICategoryBudgetWithSpent | null;
}

/**
 * "Presupuestos" — two independent questions per this slice's product
 * note, each its own section: **Sobres** (Fondos/Deudas, money set
 * aside — "cuánto tengo apartado") and **Límites del mes** (per-category
 * spending caps — "cuánto llevo gastado"). An envelope apartando money
 * NEVER touches an account/net-worth number (see `envelopesQueries.ts`'s
 * "aparta, no mueve" doc) — this screen only ever reads/writes the
 * `envelopes`/`envelope_movements`/`category_budgets` tables, nothing
 * in `accounts`/`finances`.
 *
 * Header is a two-line "Budgets" / current-month label — see
 * `MainHeader`'s new `subtitle` prop, added in this slice specifically
 * because splitting a combined title string on its first space (the
 * only way to get a second line before) mangles a multi-word month
 * label like "August 2026".
 *
 * Every mutating gesture on this screen is a bottom-sheet modal or a
 * push to `CreateEnvelope`, never an inline edit on the card/row itself
 * — none of these interactions are in the approved prototype (which
 * only shows the resulting cards/rows), so this slice picked the
 * gesture with the closest existing precedent in this codebase for
 * each one; see this slice's HANDOFF for the exact list and reasoning:
 * - **Create envelope**: the dashed "Add envelope" card at the end of
 *   the horizontal Sobres list (`CatalogList`'s existing "add" idiom).
 * - **Manage envelope** (assign / withdraw / edit / archive): tapping
 *   the card itself opens an action sheet — see `EnvelopeCard`'s doc
 *   comment for why the whole card, not a separate small button.
 * - **Set/edit a category limit**: "Set a limit" button in the Límites
 *   card opens `CategoryLimitModal` in "add" mode (category picker);
 *   tapping an EXISTING row opens the same modal in "edit" mode
 *   (category locked, amount prefilled) — see that modal's doc comment
 *   for why the category can't be changed on an edit.
 *
 * Over-allocation/overdraw are never blocked (see `envelopesQueries.ts`)
 * — `onSubmitAssign`/`onSubmitWithdraw` below always let the write
 * through, then show a plain, dismiss-only `Alert` afterward ONLY when
 * `overAllocated`/`envelopeOverdrawn` comes back `true`. This is
 * strictly a heads-up, never a confirmation gate: there is no "undo"
 * button on it, because there is nothing left to undo by the time it
 * shows — the assignment/withdrawal already succeeded.
 */
const BudgetsScreen = ({navigation}: BudgetsScreenProps) => {
  const {t} = useTranslation();
  const {
    period,
    envelopes,
    envelopesStatus,
    envelopesErrorMessage,
    reloadEnvelopes,
    availableToAssign,
    budgets,
    budgetsStatus,
    budgetsErrorMessage,
    reloadBudgets,
    categoriesWithoutBudget,
    isRefreshing,
    refresh,
    assignToEnvelopeById,
    withdrawFromEnvelopeById,
    archiveEnvelopeById,
    setCategoryLimit,
    isSavingLimit,
  } = useBudgetsScreen();

  const [assignWithdrawSheet, setAssignWithdrawSheet] =
    useState<AssignWithdrawSheetState>({visible: false, mode: 'assign', envelope: null});
  const [categoryLimitSheet, setCategoryLimitSheet] =
    useState<CategoryLimitSheetState>({visible: false, mode: 'add', budget: null});
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  const closeAssignWithdrawSheet = () =>
    setAssignWithdrawSheet(prev => ({...prev, visible: false}));
  const closeCategoryLimitSheet = () =>
    setCategoryLimitSheet(prev => ({...prev, visible: false}));

  // The one gesture for "manage this envelope" — no approved prototype
  // covers this interaction at all (see this screen's doc comment
  // above), so it reuses the app's existing "tap -> action sheet" idiom
  // (`AccountsScreen.onPressManageAccount`) rather than inventing a
  // swipe/long-press gesture with no precedent here.
  const onPressEnvelope = (envelope: IEnvelopeWithBalance) => {
    Alert.alert(envelope.name, undefined, [
      {
        text: t('budgets.assignMoney'),
        onPress: () =>
          setAssignWithdrawSheet({visible: true, mode: 'assign', envelope}),
      },
      {
        text: t('budgets.withdrawMoney'),
        onPress: () =>
          setAssignWithdrawSheet({visible: true, mode: 'withdraw', envelope}),
      },
      {
        text: t('common.edit'),
        onPress: () => navigation.navigate('EditEnvelope', {envelopeId: envelope.id}),
      },
      {
        text: t('budgets.archive'),
        style: 'destructive',
        onPress: () => onArchiveEnvelope(envelope),
      },
      {text: t('common.cancel'), style: 'cancel'},
    ]);
  };

  // Same "explain the effect, then confirm" shape as
  // `AccountsScreen.onArchiveAccount` — archiving is a soft delete in
  // the data layer, but reads as final from the user's seat.
  const onArchiveEnvelope = (envelope: IEnvelopeWithBalance) => {
    Alert.alert(
      t('budgets.archiveEnvelopeTitle'),
      t('budgets.archiveEnvelopeMessage', {name: envelope.name}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('budgets.archive'),
          style: 'destructive',
          onPress: async () => {
            const success = await archiveEnvelopeById(envelope.id);
            if (!success) {
              Alert.alert(t('common.error'), t('budgets.archiveEnvelopeErrorMessage'));
            }
          },
        },
      ],
    );
  };

  const onSubmitAssignOrWithdraw = async (amount: number) => {
    const {mode, envelope} = assignWithdrawSheet;
    if (!envelope) {
      return;
    }
    setIsSubmittingMovement(true);
    try {
      if (mode === 'assign') {
        const result = await assignToEnvelopeById(envelope.id, amount);
        if (!result) {
          Alert.alert(t('common.error'), t('budgets.assignErrorMessage'));
          return;
        }
        closeAssignWithdrawSheet();
        // Non-blocking heads-up — see this screen's doc comment. The
        // assignment already succeeded; this is context, not a gate.
        if (result.overAllocated) {
          Alert.alert(
            t('budgets.headsUp'),
            t('budgets.overAllocatedMessage', {
              amount: formatCentsToCurrency(result.availableToAssign),
            }),
          );
        }
      } else {
        const result = await withdrawFromEnvelopeById(envelope.id, amount);
        if (!result) {
          Alert.alert(t('common.error'), t('budgets.withdrawErrorMessage'));
          return;
        }
        closeAssignWithdrawSheet();
        if (result.envelopeOverdrawn) {
          Alert.alert(
            t('budgets.headsUp'),
            t('budgets.envelopeOverdrawnMessage', {
              amount: formatCentsToCurrency(result.balance),
            }),
          );
        }
      }
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const onPressAddLimit = () =>
    setCategoryLimitSheet({visible: true, mode: 'add', budget: null});

  const onPressBudget = (budget: ICategoryBudgetWithSpent) =>
    setCategoryLimitSheet({visible: true, mode: 'edit', budget});

  const onSubmitCategoryLimit = async (idCategory: number, limitAmount: number) => {
    const success = await setCategoryLimit(idCategory, limitAmount);
    if (!success) {
      Alert.alert(t('common.error'), t('budgets.limitSaveErrorMessage'));
      return;
    }
    closeCategoryLimitSheet();
  };

  return (
    <>
      <ScreenTemplate
        headerTitle={t('budgets.title')}
        headerSubtitle={getMonthLabel(period)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={[colors[accent][2]]}
          />
        }>
        <EnvelopesSection
          envelopes={envelopes}
          status={envelopesStatus}
          errorMessage={envelopesErrorMessage}
          onRetry={reloadEnvelopes}
          onPressEnvelope={onPressEnvelope}
          onPressAdd={() => navigation.navigate('CreateEnvelope')}
        />

        <CategoryLimitsSection
          budgets={budgets}
          status={budgetsStatus}
          errorMessage={budgetsErrorMessage}
          onRetry={reloadBudgets}
          onPressBudget={onPressBudget}
          onPressAddLimit={onPressAddLimit}
        />
      </ScreenTemplate>

      <AssignWithdrawModal
        visible={assignWithdrawSheet.visible}
        mode={assignWithdrawSheet.mode}
        envelope={assignWithdrawSheet.envelope}
        availableToAssign={availableToAssign}
        isSubmitting={isSubmittingMovement}
        onSubmit={onSubmitAssignOrWithdraw}
        onClose={closeAssignWithdrawSheet}
      />

      <CategoryLimitModal
        visible={categoryLimitSheet.visible}
        mode={categoryLimitSheet.mode}
        categories={categoriesWithoutBudget}
        initialCategory={categoryLimitSheet.budget?.category}
        initialLimitAmount={categoryLimitSheet.budget?.limitAmount}
        isSubmitting={isSavingLimit}
        onSubmit={onSubmitCategoryLimit}
        onClose={closeCategoryLimitSheet}
      />
    </>
  );
};

export default BudgetsScreen;
