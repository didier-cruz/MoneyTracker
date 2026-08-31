import {TransactItem} from '@components/atoms/items/TransactItem';
import {Card, Text, Title} from '@redshank/native';
import React, {FC} from 'react';
import {ActivityIndicator, SectionList, StyleSheet, View} from 'react-native';
import {colors, accent, gray} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';

type TransactList = {
  sectionData: SectionTransactItem[];
  /**
   * The list's header title — the SELECTED account's name (e.g.
   * "Efectivo"), per the approved prototype, which pairs it with
   * `headerSubtitle` (the current month) on the same baseline-aligned
   * row instead of a generic translated "Transactions" label. This
   * organism has exactly one consumer (`FragmentSection` ->
   * `AccountsScreen`), so it takes both as plain strings rather than
   * owning any account-selection or date logic itself.
   */
  headerTitle: string;
  /** Right-aligned label next to `headerTitle` — the current month's
   * name, per the approved prototype. */
  headerSubtitle: string;
  /** Called near the end of the list — wires `getFinances`' keyset
   * pagination. Omit to disable (e.g. while a prior page is loading). */
  onEndReached?: () => void;
  /** Shows a footer spinner while a next page is being fetched. */
  isLoadingMore?: boolean;
  /** Pull-to-refresh state/handler — omit to disable pull-to-refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
};

const TransactList: FC<TransactList> = ({
  sectionData,
  headerTitle,
  headerSubtitle,
  onEndReached,
  isLoadingMore = false,
  refreshing,
  onRefresh,
}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Title level={2} numberOfLines={1} style={styles.headerTitle}>
          {headerTitle}
        </Title>
        <Text color={colors[gray][0]} size={12}>
          {headerSubtitle}
        </Text>
      </View>
      <Card style={styles.card}>
        <Card.Body>
          <SectionList
            sections={sectionData}
            keyExtractor={(item, index) =>
              item.id !== undefined ? String(item.id) : `${item.category}-${index}`
            }
            style={styles.section}
            renderItem={({item}) => (
              <TransactItem {...item} containerStyle={styles.row} />
            )}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.4}
            refreshing={refreshing}
            onRefresh={onRefresh}
            renderSectionHeader={({section: {date}}) => (
              <Title level={3} style={styles.title}>
                {date}
              </Title>
            )}
            ListFooterComponent={
              isLoadingMore ? (
                <ActivityIndicator
                  style={styles.footerSpinner}
                  size="small"
                  color={colors[accent][2]}
                  accessibilityLabel={t('accounts.loadingMoreTransactions')}
                />
              ) : null
            }
          />
        </Card.Body>
      </Card>
    </View>
  );
};
/** Mismo alto de fila y mismo divisor que `TransactCard` en Resumen:
 * las dos listas de movimientos comparten ahora la misma anatomia. */
const ROW_HEIGHT = 82;

/** Sangria horizontal del contenido dentro de la tarjeta: sin ella las
 * filas y las cabeceras de fecha quedan pegadas al borde. Igual en las
 * dos listas de movimientos (Cuentas y Resumen) para que compartan
 * anatomia. */
const CONTENT_PADDING = 16;


const styles = StyleSheet.create({
  container: {width: '100%'},
  section: {width: '100%', padding: 0},
  card: {width: '100%'},
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  headerTitle: {
    flexShrink: 1,
    marginRight: 10,
  },
  title: {
    color: '#A09FAE',
    marginTop: 20,
    paddingHorizontal: CONTENT_PADDING,
  },
  footerSpinner: {
    marginVertical: 15,
  },
});

export default TransactList;
