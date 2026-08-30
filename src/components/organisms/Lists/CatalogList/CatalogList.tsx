import {FC} from 'react';
import {CatalogCard} from '@components/molecules/Cards/CatalogCard';
import {FlatList, View} from 'react-native';

const CatalogList: FC<CatalogList> = ({
  data,
  selectedId,
  onPressItem,
  onPressManageItem,
}) => {
  return (
    <FlatList
      keyExtractor={item => item.id.toString()}
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      renderItem={({item}) => (
        <CatalogCard
          id={item.id}
          icon={item.icon}
          iconColor={item.iconColor}
          iconBackground={item.iconBackground}
          field={item.field}
          balance={item.balance}
          selectedId={selectedId}
          variant={item.variant}
          onPress={() => onPressItem(item.id)}
          onPressManage={
            onPressManageItem && item.variant !== 'add'
              ? () => onPressManageItem(item.id)
              : undefined
          }
        />
      )}
      ListFooterComponent={<View style={{marginLeft: 20}}></View>}
    />
  );
};

export default CatalogList;
