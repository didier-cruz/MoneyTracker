import {IAccountWithBalance, IFinanceRow} from '@db/queries';
import {colors} from '@constants/colors/colors';
import {formatDisplayDate, formatDisplayTime, toLocalDateKey} from '@utils/dateFormat';
import i18n from '@i18n';

/**
 * Sentinel id for the trailing "add account" affordance appended to the
 * account row by `mapAccountsToCatalogCards` — NOT a real account id
 * (`accounts.id` is an `AUTOINCREMENT` primary key, always >= 1), so it
 * can never collide with one. `AccountsScreen`'s `onPressItem` checks
 * for this id to navigate to `CreateAccount` instead of selecting it.
 */
export const ADD_ACCOUNT_CARD_ID = -1;

/**
 * Maps `getAccounts`' rows to `CatalogList`'s `CatalogCard` shape, plus
 * one trailing synthetic "add account" card (see `ADD_ACCOUNT_CARD_ID`)
 * — this affordance was not in the approved prototype (see this
 * screen's HANDOFF note) but is required for "manage my accounts" to
 * be a complete story past the single seeded "Efectivo" account.
 *
 * A `receivable` account renders as the wide card the prototype calls
 * for; everything else is a square card. `iconColor`/`iconBackground`
 * are uniform across every account (matching the original static mock,
 * which used the same `colors.primary`/`colors.white` pair for all
 * three of its rows) — nothing in the approved design varies this per
 * account/kind.
 */
export const mapAccountsToCatalogCards = (
  accounts: IAccountWithBalance[],
): CatalogCard[] => {
  const accountCards: CatalogCard[] = accounts.map(account => ({
    id: account.id,
    icon: account.icon,
    iconColor: colors.white[0],
    iconBackground: colors.primary[0],
    field: account.name,
    balance: account.balance,
    variant: account.kind === 'receivable' ? 'wide' : 'square',
  }));

  const addAccountCard: CatalogCard = {
    id: ADD_ACCOUNT_CARD_ID,
    icon: 'plus',
    iconColor: colors.primary[0],
    iconBackground: colors.inactive[0],
    field: i18n.t('accounts.addAccount'),
    balance: 0,
    variant: 'add',
  };

  return [...accountCards, addAccountCard];
};

/**
 * Labels a transfer leg (`row.transferGroupId !== null`) using the sign
 * of THIS row's `amount` plus `transferCounterpartAccount`'s `kind` —
 * exactly what `getFinances`' doc comment calls out as the point of
 * resolving that field via JOIN instead of a bare "Transfer": it lets
 * this list say who the money moved with, and reads the `receivable`
 * kind specifically as the loan/repayment story Problem 01 is about
 * (see `Transfer`'s own doc comment).
 *
 * - `amount < 0` — money LEFT this row's account, regardless of the
 *   counterpart's kind: `"Transfer to <counterpart>"`. When the
 *   counterpart is a `receivable` account, this IS the lending event
 *   (`insertTransfer`'s own doc: transferring INTO a `receivable`
 *   account is lending) — the counterpart's own name (e.g. a user-named
 *   "Juan me debe" receivable account) already carries that meaning, so
 *   the verb here stays the same "Transfer to X" either way.
 * - `amount > 0` AND the counterpart is `receivable` —
 *   `"Payment from <counterpart>"`: this is specifically the repayment
 *   leg (transferring back OUT of a `receivable` account), which reads
 *   better as a payment/"abono" than a generic transfer.
 * - `amount > 0`, any other counterpart kind — `"Transfer from
 *   <counterpart>"`: an ordinary transfer between two of the user's own
 *   non-receivable accounts.
 */
const getTransferLabel = (row: IFinanceRow): string => {
  const name = row.transferCounterpartAccount?.name ?? i18n.t('common.transfer.unknownAccount');
  if (row.amount < 0) {
    return i18n.t('common.transfer.to', {name});
  }
  if (row.transferCounterpartAccount?.kind === 'receivable') {
    return i18n.t('common.transfer.paymentFrom', {name});
  }
  return i18n.t('common.transfer.from', {name});
};

/**
 * Groups `getFinances`' flat, newest-first rows into `TransactList`'s
 * day-sectioned shape, recomputed from the full flat list every time it
 * changes (rather than incrementally as pages arrive) — the simplest
 * way to keep two pages that land on the same calendar day merged into
 * one section instead of duplicated.
 *
 * A transfer leg has `category: null` (see `getFinances`'s doc comment)
 * — its label comes from `getTransferLabel` instead of a category name,
 * and its icon falls back to a neutral `exchange` glyph (no per-kind
 * icon is called for by the approved prototype). `color` is derived
 * from `row.amount`'s OWN sign for every row, transfer or not, rather
 * than from `category?.type` — a transfer row has no category (`type`
 * would always read as "not income", tinting every transfer leg's icon
 * red regardless of direction), and for a categorized row `amount`'s
 * sign already agrees with `category.type` by construction
 * (`insertFinance` derives one from the other), so this is a strict
 * simplification, not a behavior change for non-transfer rows.
 */
export const groupFinancesByDate = (rows: IFinanceRow[]): SectionTransactItem[] => {
  const sections: SectionTransactItem[] = [];
  const sectionIndexByDateKey = new Map<string, number>();

  for (const row of rows) {
    const dateKey = toLocalDateKey(row.dateCreated);
    const transactItem: TransactItem = {
      id: row.id,
      icon: row.category?.icon ?? 'exchange',
      category: row.category?.name ?? getTransferLabel(row),
      amount: row.amount,
      date: formatDisplayTime(row.dateCreated),
      color: row.amount > 0 ? colors.success[0] : colors.error[0],
    };

    const existingSectionIndex = sectionIndexByDateKey.get(dateKey);
    if (existingSectionIndex !== undefined) {
      sections[existingSectionIndex].data.push(transactItem);
    } else {
      sectionIndexByDateKey.set(dateKey, sections.length);
      sections.push({
        date: formatDisplayDate(row.dateCreated),
        data: [transactItem],
      });
    }
  }

  return sections;
};
