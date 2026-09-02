import {useState} from 'react';
import {RefreshControl} from 'react-native';
import {useTranslation} from 'react-i18next';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {faCoins} from '@fortawesome/free-solid-svg-icons/faCoins';
import {faArrowUpFromBracket} from '@fortawesome/free-solid-svg-icons/faArrowUpFromBracket';
import {faPen} from '@fortawesome/free-solid-svg-icons/faPen';
import {faBoxArchive} from '@fortawesome/free-solid-svg-icons/faBoxArchive';
import {ScreenTemplate} from '@components/templates/ScreenTemplate';
import {ActionSheet, ConfirmDialog} from '@components/organisms/feedback';
import {BudgetsNavParams} from '@navigation/[budgets]/BudgetsNavigator/types';
import {ICategoryBudgetWithSpent, IEnvelopeWithBalance} from '@db/queries';
import {colors, accent} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {useBudgetsScreen} from '@hooks/useBudgetsScreen';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {getDaysRemainingInMonth, getMonthLabel} from './mappers';
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
  extends NativeStackScreenProps<BudgetsNavParams, 'BudgetsHome'> {}

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

interface EnvelopeMenuState {
  visible: boolean;
  envelope: IEnvelopeWithBalance | null;
}

interface DeleteLimitConfirmState {
  visible: boolean;
  budget: ICategoryBudgetWithSpent | null;
}

interface ArchiveEnvelopeConfirmState {
  visible: boolean;
  envelope: IEnvelopeWithBalance | null;
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
 *   the card itself opens an `ActionSheet` — see `EnvelopeCard`'s doc
 *   comment for why the whole card, not a separate small button.
 * - **Set/edit a category limit**: "Set a limit" button in the Límites
 *   card opens `CategoryLimitModal` in "add" mode (category picker);
 *   tapping an EXISTING row opens the same modal in "edit" mode
 *   (category locked, amount prefilled) — see that modal's doc comment
 *   for why the category can't be changed on an edit.
 *
 * Every native `Alert.alert` this screen used to show is now one of the
 * two feedback components in `@components/organisms/feedback`: the
 * envelope manage menu is an `ActionSheet`, archiving is a `danger`
 * `ConfirmDialog`, and every dismiss-only notice (`common.error`
 * failures AND the two non-blocking heads-ups below) shares ONE
 * `ConfirmDialog` via `useNoticeDialog` — only one of those notices is
 * ever on screen at a time, so one shared piece of state is simpler
 * than one per call site.
 *
 * Over-allocation/overdraw are never blocked (see `envelopesQueries.ts`)
 * — `onSubmitAssign`/`onSubmitWithdraw` below always let the write
 * through, then show a `warning`-tone notice afterward ONLY when
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
    deleteCategoryLimitById,
  } = useBudgetsScreen();

  const {notice, showNotice, dismissNotice} = useNoticeDialog();

  const [assignWithdrawSheet, setAssignWithdrawSheet] =
    useState<AssignWithdrawSheetState>({visible: false, mode: 'assign', envelope: null});
  const [categoryLimitSheet, setCategoryLimitSheet] =
    useState<CategoryLimitSheetState>({visible: false, mode: 'add', budget: null});
  const [envelopeMenu, setEnvelopeMenu] =
    useState<EnvelopeMenuState>({visible: false, envelope: null});
  const [archiveConfirm, setArchiveConfirm] =
    useState<ArchiveEnvelopeConfirmState>({visible: false, envelope: null});
  const [deleteLimitConfirm, setDeleteLimitConfirm] =
    useState<DeleteLimitConfirmState>({visible: false, budget: null});
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  const closeAssignWithdrawSheet = () =>
    setAssignWithdrawSheet(prev => ({...prev, visible: false}));
  const closeCategoryLimitSheet = () =>
    setCategoryLimitSheet(prev => ({...prev, visible: false}));
  const closeEnvelopeMenu = () => setEnvelopeMenu(prev => ({...prev, visible: false}));
  const closeArchiveConfirm = () => setArchiveConfirm(prev => ({...prev, visible: false}));
  const closeDeleteLimitConfirm = () =>
    setDeleteLimitConfirm(prev => ({...prev, visible: false}));

  // Local `const`s (not the raw `envelopeMenu.envelope`/`archiveConfirm
  // .envelope` property accesses) so TypeScript can actually narrow
  // `| null` away inside the JSX closures below — a property access
  // doesn't narrow across a nested function boundary, a `const` does.
  const menuEnvelope = envelopeMenu.envelope;
  const confirmingEnvelope = archiveConfirm.envelope;
  const confirmingBudget = deleteLimitConfirm.budget;

  // The one gesture for "manage this envelope" — no approved prototype
  // covers this interaction at all (see this screen's doc comment
  // above), so it reuses the app's existing "tap -> action sheet" idiom
  // (`AccountsScreen.onPressManageAccount`) rather than inventing a
  // swipe/long-press gesture with no precedent here.
  const onPressEnvelope = (envelope: IEnvelopeWithBalance) => {
    setEnvelopeMenu({visible: true, envelope});
  };

  // Same "explain the effect, then confirm" shape as
  // `AccountsScreen.onArchiveAccount` — archiving is a soft delete in
  // the data layer, but reads as final from the user's seat.
  const onConfirmArchiveEnvelope = async () => {
    if (!confirmingEnvelope) {
      return;
    }
    closeArchiveConfirm();
    const success = await archiveEnvelopeById(confirmingEnvelope.id);
    if (!success) {
      showNotice('danger', t('common.error'), t('budgets.archiveEnvelopeErrorMessage'));
    }
  };

  // Borrar un limite se confirma igual que archivar un sobre: es
  // irreversible y no hay deshacer. El mensaje aclara lo que la gente
  // suele temer al borrar algo en una app de dinero — que se lleve por
  // delante los movimientos de la categoria, cosa que no ocurre.
  const onPressDeleteBudget = (budget: ICategoryBudgetWithSpent) => {
    setDeleteLimitConfirm({visible: true, budget});
  };

  const onConfirmDeleteBudget = async () => {
    if (!confirmingBudget) {
      return;
    }
    closeDeleteLimitConfirm();
    const success = await deleteCategoryLimitById(confirmingBudget.id);
    if (!success) {
      showNotice('danger', t('common.error'), t('budgets.deleteLimitErrorMessage'));
    }
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
          showNotice('danger', t('common.error'), t('budgets.assignErrorMessage'));
          return;
        }
        closeAssignWithdrawSheet();
        // Non-blocking heads-up — see this screen's doc comment. The
        // assignment already succeeded; this is context, not a gate.
        if (result.overAllocated) {
          showNotice(
            'warning',
            t('budgets.headsUp'),
            t('budgets.overAllocatedMessage', {
              amount: formatCentsToCurrency(result.availableToAssign),
            }),
          );
        }
      } else {
        const result = await withdrawFromEnvelopeById(envelope.id, amount);
        if (!result) {
          showNotice('danger', t('common.error'), t('budgets.withdrawErrorMessage'));
          return;
        }
        closeAssignWithdrawSheet();
        if (result.envelopeOverdrawn) {
          showNotice(
            'warning',
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
      showNotice('danger', t('common.error'), t('budgets.limitSaveErrorMessage'));
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
          daysRemainingInMonth={getDaysRemainingInMonth(period)}
          onRetry={reloadBudgets}
          onPressBudget={onPressBudget}
          onDeleteBudget={onPressDeleteBudget}
          onPressAddLimit={onPressAddLimit}
          categoriesWithoutLimitCount={categoriesWithoutBudget.length}
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

      <ActionSheet
        visible={envelopeMenu.visible}
        title={menuEnvelope?.name ?? ''}
        onClose={closeEnvelopeMenu}
        actions={
          menuEnvelope
            ? [
                {
                  key: 'assign',
                  label: t('budgets.assignMoney'),
                  icon: faCoins,
                  onPress: () =>
                    setAssignWithdrawSheet({visible: true, mode: 'assign', envelope: menuEnvelope}),
                },
                {
                  key: 'withdraw',
                  label: t('budgets.withdrawMoney'),
                  icon: faArrowUpFromBracket,
                  onPress: () =>
                    setAssignWithdrawSheet({
                      visible: true,
                      mode: 'withdraw',
                      envelope: menuEnvelope,
                    }),
                },
                {
                  key: 'edit',
                  label: t('common.edit'),
                  icon: faPen,
                  onPress: () =>
                    navigation.navigate('EditEnvelope', {envelopeId: menuEnvelope.id}),
                },
                {
                  key: 'archive',
                  label: t('budgets.archive'),
                  icon: faBoxArchive,
                  tone: 'destructive',
                  onPress: () => setArchiveConfirm({visible: true, envelope: menuEnvelope}),
                },
              ]
            : []
        }
      />

      <ConfirmDialog
        visible={archiveConfirm.visible}
        tone="danger"
        title={t('budgets.archiveEnvelopeTitle')}
        message={
          confirmingEnvelope
            ? t('budgets.archiveEnvelopeMessage', {name: confirmingEnvelope.name})
            : ''
        }
        onRequestClose={closeArchiveConfirm}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={closeArchiveConfirm}
        primaryLabel={t('budgets.archive')}
        destructive
        onPrimaryPress={onConfirmArchiveEnvelope}
      />

      <ConfirmDialog
        visible={deleteLimitConfirm.visible}
        tone="danger"
        title={t('budgets.deleteLimitTitle')}
        message={
          confirmingBudget
            ? t('budgets.deleteLimitMessage', {
                name: confirmingBudget.category.name,
              })
            : ''
        }
        onRequestClose={closeDeleteLimitConfirm}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={closeDeleteLimitConfirm}
        primaryLabel={t('budgets.deleteLimit')}
        destructive
        onPrimaryPress={onConfirmDeleteBudget}
      />

      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={dismissNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={dismissNotice}
      />
    </>
  );
};

export default BudgetsScreen;
