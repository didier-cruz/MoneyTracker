import {colors} from '@constants/colors/colors';
import {SegmentedControl} from '@components/atoms/SegmentedControl';
import {useTranslation} from 'react-i18next';

export type TransactionType = 'expense' | 'income';

type Props = {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
};

/**
 * The Gasto/Ingreso segmented control from the approved prototype — now
 * a thin wrapper over the shared `SegmentedControl` atom (see that
 * component's doc comment), keeping only what's specific to THIS
 * control: the expense-is-red/income-is-green tint pairing, which is
 * NOT a one-off — it's the exact same pairing already used everywhere
 * money is signed (`TransactItem`, the Cuentas/Categorías/Resumen
 * mappers). The prototype only drew the "Gasto" state active; reusing
 * this app's existing color language for "Ingreso" active keeps it
 * consistent rather than inventing a new meaning for green/red on this
 * one screen.
 */
export const TypeSegment = ({value, onChange}: Props) => {
  const {t} = useTranslation();

  return (
    <SegmentedControl<TransactionType>
      value={value}
      onChange={onChange}
      options={[
        {value: 'expense', label: t('form.segmentExpense'), activeColor: colors.error[0]},
        {value: 'income', label: t('form.segmentIncome'), activeColor: colors.success[0]},
      ]}
    />
  );
};

export default TypeSegment;
