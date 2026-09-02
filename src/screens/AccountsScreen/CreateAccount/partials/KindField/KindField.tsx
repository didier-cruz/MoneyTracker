import {ChipSelect, ChipSelectOption} from '@components/atoms/ChipSelect';
import {ACCOUNT_KINDS, AccountKind} from '@db/queries';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import i18n from '@i18n';

type Props = {
  value: AccountKind;
  onChange: (kind: AccountKind) => void;
};

/**
 * Translated label for an account `kind` — used both here (radio
 * options) and by `ArchivedAccounts` (row subtitle/accessibility
 * label). Plain `i18n.t` (not `useTranslation`) so it also works
 * outside a component's render; callers that render its result should
 * still call `useTranslation()` themselves so they re-render (and
 * re-read this) when the language changes.
 */
export const getKindLabel = (kind: AccountKind): string => i18n.t(`accounts.kindLabels.${kind}`);

const styles = StyleSheet.create({
  container: {width: '100%'},
});

/**
 * Tipo de cuenta: efectivo / banco / tarjeta / por cobrar.
 *
 * Fue `@redshank/native`'s `Radio.Group` y despues `SegmentedControl`.
 * Ahora usa `ChipSelect`, y es el unico campo de la app que lo hace: con
 * CUATRO opciones el control segmentado se partia en una rejilla 2x2 que
 * ya no se leia como un control sino como cuatro botones sueltos sobre
 * un fondo compartido. Los demas selectores del proyecto (Gasto/Ingreso,
 * Fondo/Deuda, gasto/ingreso de una categoria) tienen dos opciones que
 * se leen como extremos de un mismo eje, y ahi el segmentado sigue
 * siendo el control correcto.
 *
 * Lleva etiqueta propia porque, a diferencia de los campos de texto que
 * lo rodean, un grupo de chips no tiene placeholder donde decir que se
 * esta eligiendo.
 */
const KindField = ({value, onChange}: Props) => {
  const {t} = useTranslation();
  const options: ChipSelectOption<AccountKind>[] = ACCOUNT_KINDS.map(kind => ({
    value: kind,
    label: getKindLabel(kind),
  }));

  return (
    <View style={styles.container}>
      <ChipSelect
        label={t('accounts.accountTypeLabel')}
        value={value}
        onChange={onChange}
        options={options}
      />
    </View>
  );
};

export default KindField;
