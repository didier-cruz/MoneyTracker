import {TransactItem} from '@components/atoms/items/TransactItem';
import {Title} from '@redshank/native';
import React, {FC} from 'react';
import {ActivityIndicator, SectionList, StyleSheet} from 'react-native';
import {colors, accent} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';

type TransactList = {
  sectionData: SectionTransactItem[];
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
  onEndReached,
  isLoadingMore = false,
  refreshing,
  onRefresh,
}) => {
  const {t} = useTranslation();
  return (
    <SectionList
      sections={sectionData}
      keyExtractor={(item, index) =>
        item.id !== undefined ? String(item.id) : `${item.category}-${index}`
      }
      style={styles.section}
      renderItem={({item}) => <TransactItem {...item} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={
        <Title level={2} style={styles.header}>
          {t('accounts.transactions')}
        </Title>
      }
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
  );
};
const styles = StyleSheet.create({
  section: {width: '100%', padding: 0},
  item: {
    backgroundColor: '#f9c2ff',
    padding: 20,
    marginVertical: 8,
  },
  header: {
    marginTop: 20,
  },
  title: {
    color: '#A09FAE',
    marginTop: 20,
  },
  footerSpinner: {
    marginVertical: 15,
  },
});

export default TransactList;
