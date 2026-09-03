import {useState} from 'react';
import {ConfirmDialogTone} from '@components/organisms/feedback/ConfirmDialog/ConfirmDialog';

export interface NoticeDialogState {
  visible: boolean;
  tone: ConfirmDialogTone;
  title: string;
  message: string;
}

const INITIAL_STATE: NoticeDialogState = {
  visible: false,
  tone: 'info',
  title: '',
  message: '',
};

/**
 * Shared state for a single-button `ConfirmDialog` — every call site
 * that replaced a dismiss-only `Alert.alert` (success confirmations,
 * non-blocking heads-up notices, `common.error` failures) needed the
 * exact same `{visible, tone, title, message}` shape plus an
 * open/dismiss pair, so it's factored out here instead of duplicated at
 * each of the six sites (`BudgetsScreen`, `AccountsScreen`,
 * `ArchivedAccounts`, `useAccountForm`, `useEnvelopeForm`,
 * `useCategoryForm`).
 *
 * This is also how `useAccountForm`/`useEnvelopeForm`/`useCategoryForm`
 * resolve the "a hook can't render JSX" problem: those hooks call
 * `showNotice` from plain logic (after an insert/update resolves) and
 * expose the resulting `notice` state on their return value: the hook
 * never renders anything, it just describes what its OWN screen
 * (`CreateAccount`/`CreateCategory`) should show, and that screen owns
 * the single `<ConfirmDialog>` element reading it.
 */
export const useNoticeDialog = () => {
  const [notice, setNotice] = useState<NoticeDialogState>(INITIAL_STATE);

  const showNotice = (tone: ConfirmDialogTone, title: string, message: string) =>
    setNotice({visible: true, tone, title, message});

  const dismissNotice = () => setNotice(prev => ({...prev, visible: false}));

  return {notice, showNotice, dismissNotice};
};
