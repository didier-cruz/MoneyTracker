import {FC} from 'react';
import {useTranslation} from 'react-i18next';

import {ActionSheet, ActionSheetAction} from '../ActionSheet';
import {ConfirmDialog} from '../ConfirmDialog';
import {NoticeDialogState} from '@hooks/useNoticeDialog';

type TransactionActionsDialogsProps = {
  menuVisible: boolean;
  menuTitle: string;
  actions: ActionSheetAction[];
  onCloseMenu: () => void;

  confirmVisible: boolean;
  confirmTitle: string;
  confirmMessage: string;
  onCloseConfirm: () => void;
  onConfirmDelete: () => void;

  notice: NoticeDialogState;
  onDismissNotice: () => void;
};

/**
 * Los tres dialogos que necesita `useTransactionActions`: el menu de
 * administrar, la confirmacion de borrado y el aviso de error.
 *
 * Van en un componente y no dentro del hook porque un hook no puede
 * devolver JSX sin dejar de ser un hook; asi cada pantalla anade UNA
 * linea (`<TransactionActionsDialogs {...dialogProps} />`) en vez de
 * repetir treinta.
 */
export const TransactionActionsDialogs: FC<TransactionActionsDialogsProps> = ({
  menuVisible,
  menuTitle,
  actions,
  onCloseMenu,
  confirmVisible,
  confirmTitle,
  confirmMessage,
  onCloseConfirm,
  onConfirmDelete,
  notice,
  onDismissNotice,
}) => {
  const {t} = useTranslation();
  return (
    <>
      <ActionSheet
        visible={menuVisible}
        onClose={onCloseMenu}
        title={menuTitle}
        actions={actions}
      />

      <ConfirmDialog
        visible={confirmVisible}
        tone="danger"
        title={confirmTitle}
        message={confirmMessage}
        onRequestClose={onCloseConfirm}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={onCloseConfirm}
        primaryLabel={t('form.deleteTransaction')}
        destructive
        onPrimaryPress={onConfirmDelete}
      />

      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={onDismissNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={onDismissNotice}
      />
    </>
  );
};

export default TransactionActionsDialogs;
