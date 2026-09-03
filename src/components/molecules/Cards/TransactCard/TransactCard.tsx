import {Card} from '@components/atoms/Card';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {FC, Fragment} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {TransactItem} from '@components/atoms/items/TransactItem';
import {colors} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';

/** The approved prototype's 82pt row height for THIS card only — see
 * `TransactItem.containerStyle`'s own doc for why this is opt-in per
 * caller rather than the shared atom's new default. */
const ROW_HEIGHT = 82;

/** Sangria horizontal del contenido dentro de la tarjeta: sin ella las
 * filas y las cabeceras de fecha quedan pegadas al borde. Igual en las
 * dos listas de movimientos (Cuentas y Resumen) para que compartan
 * anatomia. */
const CONTENT_PADDING = 16;


type TransactCardProps = {
  transactions: TransactItem[];
  /** Pulsacion larga sobre una fila: administrar el movimiento. */
  onLongPressItem?: (financeId: number) => void;
  /** "See all" (lime, top-right) — omit to hide the link entirely. No
   * approved destination exists for it yet on `ResumenScreen` (see that
   * screen's HANDOFF note); left optional so this component itself
   * doesn't have to know or care what "all" means for its caller. */
  onPressSeeAll?: () => void;
};

const TransactCard: FC<TransactCardProps> = ({
  transactions,
  onPressSeeAll,
  onLongPressItem,
}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Title level={2} style={styles.title}>
          {t('resumen.movements')}
        </Title>
        {onPressSeeAll && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('resumen.seeAllMovements')}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={onPressSeeAll}>
            <Text color={colors.accent[2]} size={13} bold>
              {t('resumen.seeAll')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <Card style={styles.card}>
        <Card.Body>
          {transactions.map((transaction, index) => (
            <Fragment key={transaction.id ?? index}>
              {index > 0 && <View style={styles.divider} />}
              <TransactItem
                {...transaction}
                containerStyle={styles.row}
                onLongPress={
                  onLongPressItem && transaction.id !== undefined
                    ? () => onLongPressItem(transaction.id as number)
                    : undefined
                }
              />
            </Fragment>
          ))}
        </Card.Body>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    marginBottom: 15,
  },
  card: {
    width: '100%',
  },
  row: {
    height: ROW_HEIGHT,
    paddingHorizontal: CONTENT_PADDING,
  },
  divider: {
    width: '90%',
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5FA',
    alignSelf: 'center',
  },
});

export default TransactCard;
