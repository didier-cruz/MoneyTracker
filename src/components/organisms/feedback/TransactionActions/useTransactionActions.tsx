import {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {faPen} from '@fortawesome/free-solid-svg-icons/faPen';
import {faTrash} from '@fortawesome/free-solid-svg-icons/faTrash';

import {getDbConnection} from '@db/db';
import {deleteFinance, getFinanceById, IFinanceRow} from '@db/queries';
import {formatCentsToCurrency} from '@utils/currency';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {ActionSheetAction} from '../ActionSheet';

type UseTransactionActionsOptions = {
  /** Abre la edicion. Lo decide cada pantalla porque cada una cuelga de
   * un navegador distinto y llegar a `EditTransaction` no se escribe
   * igual desde Balance que desde Categorias. */
  onEdit: (financeId: number) => void;
  /** Se llama tras un borrado con exito, para que la pantalla recargue
   * sus listas y sus totales. */
  onChanged: () => void;
};

/**
 * Editar y eliminar un movimiento, desde cualquier lista que los pinte.
 *
 * Las tres listas de la app (Balance, Cuentas y Categorias) trabajan con
 * `TransactItem`, una forma aplanada para pintar que no lleva
 * `idCategory` ni `transferGroupId`. Al pulsar largo solo se conoce el
 * id, asi que aqui se RELEE la fila real: hace falta saber si es una
 * pata de transferencia antes de ofrecer editarla, y cuantas filas se
 * van a borrar.
 *
 * Vive en un hook compartido y no en cada pantalla porque las tres
 * necesitan exactamente el mismo menu, la misma confirmacion y el mismo
 * aviso de error; tenerlo tres veces garantiza que a la tercera copia se
 * le olvide algo.
 */
export const useTransactionActions = ({
  onEdit,
  onChanged,
}: UseTransactionActionsOptions) => {
  const {t} = useTranslation();
  const {notice, showNotice, dismissNotice} = useNoticeDialog();

  const [menu, setMenu] = useState<{visible: boolean; row?: IFinanceRow}>({
    visible: false,
  });
  const [confirm, setConfirm] = useState<{visible: boolean; row?: IFinanceRow}>({
    visible: false,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const menuRow = menu.row;
  const confirmRow = confirm.row;

  const closeMenu = () => setMenu(prev => ({...prev, visible: false}));
  const closeConfirm = () => setConfirm(prev => ({...prev, visible: false}));

  /** Punto de entrada: la lista solo pasa el id del movimiento pulsado. */
  const open = useCallback(
    async (financeId: number) => {
      try {
        const db = await getDbConnection();
        const row = await getFinanceById(db, financeId);
        if (!row) {
          showNotice('danger', t('common.error'), t('form.transactionNotFound'));
          return;
        }
        setMenu({visible: true, row});
      } catch {
        showNotice('danger', t('common.error'), t('form.loadTransactionFailed'));
      }
    },
    [showNotice, t],
  );

  const onPressEdit = () => {
    if (!menuRow) {
      return;
    }
    const row = menuRow;
    closeMenu();
    if (row.transferGroupId !== null) {
      // Una transferencia no se edita: son dos filas espejo y tocar una
      // sola inventaria dinero. Ver `updateFinance`.
      showNotice('info', t('form.transferNotEditableTitle'), t('form.transferNotEditable'));
      return;
    }
    onEdit(row.id);
  };

  const onPressDelete = () => {
    if (!menuRow) {
      return;
    }
    const row = menuRow;
    closeMenu();
    setConfirm({visible: true, row});
  };

  const onConfirmDelete = async () => {
    if (!confirmRow) {
      return;
    }
    const row = confirmRow;
    closeConfirm();
    setIsDeleting(true);
    try {
      const db = await getDbConnection();
      const result = await deleteFinance(db, row.id);
      if (result.deleted === 0) {
        showNotice('danger', t('common.error'), t('form.deleteTransactionError'));
        return;
      }
      onChanged();
    } catch {
      showNotice('danger', t('common.error'), t('form.deleteTransactionError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const describeRow = (row: IFinanceRow): string => {
    // Un movimiento sin categoria puede ser DOS cosas distintas y no se
    // leen igual: una transferencia (no tiene categoria por diseno) o un
    // gasto normal cuya categoria se borro. Decidirlo por
    // `transferGroupId` y no por la ausencia de categoria — el mismo
    // error que `describeUncategorized` ya corrige en los mappers.
    const label =
      row.category?.name ??
      (row.transferGroupId !== null
        ? t('common.transfer.label')
        : t('common.noCategory'));
    return `${label} · ${formatCentsToCurrency(row.amount)}`;
  };

  const actions: ActionSheetAction[] = [
    {
      key: 'edit',
      label: t('form.editTransaction'),
      icon: faPen,
      onPress: onPressEdit,
    },
    {
      key: 'delete',
      label: t('form.deleteTransaction'),
      icon: faTrash,
      tone: 'destructive',
      onPress: onPressDelete,
    },
  ];

  const confirmMessage = (): string => {
    if (!confirmRow) {
      return '';
    }
    // Una transferencia avisa de que se van LAS DOS patas: el usuario
    // pulso una fila y se van a borrar dos, y no decirlo seria una
    // sorpresa desagradable en una app de dinero.
    return confirmRow.transferGroupId !== null
      ? t('form.deleteTransferMessage', {
          from: confirmRow.account.name,
          to: confirmRow.transferCounterpartAccount?.name ?? t('common.transfer.unknownAccount'),
          amount: formatCentsToCurrency(Math.abs(confirmRow.amount)),
        })
      : t('form.deleteTransactionMessage', {
          description: describeRow(confirmRow),
        });
  };

  return {
    open,
    isDeleting,
    /** Se esparce sobre `<TransactionActionsDialogs {...dialogProps} />`. */
    dialogProps: {
      menuVisible: menu.visible,
      menuTitle: menuRow ? describeRow(menuRow) : '',
      actions,
      onCloseMenu: closeMenu,

      confirmVisible: confirm.visible,
      confirmTitle: t('form.deleteTransactionTitle'),
      confirmMessage: confirmMessage(),
      onCloseConfirm: closeConfirm,
      onConfirmDelete,

      notice,
      onDismissNotice: dismissNotice,
    },
  };
};
