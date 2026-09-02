import {useMemo, useState} from 'react';
import {FlatList, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import {useTranslation} from 'react-i18next';

import {BottomSheet} from '@components/organisms/feedback';
import {Text} from '@components/atoms/text/Text';
import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {ICON_GROUPS, searchIconNames, toIcon} from '@data/iconCatalog';
import {ICON_KEYWORDS_ES} from '@data/iconKeywords';

const COLUMNS = 5;
const SEARCH_RESULT_LIMIT = 60;

type Row =
  | {kind: 'heading'; key: string; label: string}
  | {kind: 'icons'; key: string; names: string[]};

type IconPickerProps = {
  visible: boolean;
  onClose: () => void;
  /** Nombre del icono ya elegido, para marcarlo. */
  selectedName?: string;
  onSelect: (icon: IIcon) => void;
};

/**
 * Selector de iconos completo: los 182 iconos curados repartidos por tema,
 * mas una busqueda que recorre el juego entero de FontAwesome 4.7 (786),
 * de modo que ninguno queda inalcanzable.
 *
 * Toda la hoja es UNA sola `FlatList` —titulos de grupo incluidos, como
 * filas de tipo `heading`— por el motivo que documenta `BottomSheet`: meter
 * una segunda lista con scroll propio dentro de una hoja reactiva el aviso
 * "VirtualizedLists should never be nested inside plain ScrollViews".
 *
 * Las filas agrupan `COLUMNS` iconos cada una en lugar de usar
 * `numColumns`, porque `numColumns` no admite filas de altura distinta y
 * aqui conviven titulos y rejilla en la misma lista.
 */
export const IconPicker = ({
  visible,
  onClose,
  selectedName,
  onSelect,
}: IconPickerProps) => {
  const {t, i18n} = useTranslation();
  const [query, setQuery] = useState('');

  // Los alias solo existen en espanol; en ingles el nombre del icono YA es
  // la palabra que el usuario escribiria.
  const keywords =
    i18n.language.startsWith('es') ? ICON_KEYWORDS_ES : undefined;

  const rows = useMemo<Row[]>(() => {
    const chunk = (names: string[], keyPrefix: string): Row[] => {
      const chunks: Row[] = [];
      for (let i = 0; i < names.length; i += COLUMNS) {
        chunks.push({
          kind: 'icons',
          key: `${keyPrefix}-${i}`,
          names: names.slice(i, i + COLUMNS),
        });
      }
      return chunks;
    };

    if (query.trim() !== '') {
      const matches = searchIconNames(query, keywords).slice(
        0,
        SEARCH_RESULT_LIMIT,
      );
      return chunk(matches, 'search');
    }

    return ICON_GROUPS.flatMap(group => [
      {
        kind: 'heading' as const,
        key: `heading-${group.key}`,
        label: t(`icons.groups.${group.key}` as const),
      },
      ...chunk(group.icons, group.key),
    ]);
  }, [query, t, keywords]);

  const isSearching = query.trim() !== '';
  const noResults = isSearching && rows.length === 0;

  const handleSelect = (name: string) => {
    onSelect(toIcon(name));
    setQuery('');
    onClose();
  };

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const renderRow = ({item}: {item: Row}) => {
    if (item.kind === 'heading') {
      return (
        <Text size={13} color={colors[gray][1]} style={styles.heading}>
          {item.label.toUpperCase()}
        </Text>
      );
    }
    return (
      <View style={styles.row}>
        {item.names.map(name => {
          const isSelected = name === selectedName;
          return (
            <TouchableOpacity
              key={name}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityState={{selected: isSelected}}
              onPress={() => handleSelect(name)}
              style={styles.cell}>
              <View
                style={[
                  styles.iconWrapper,
                  isSelected && {backgroundColor: colors[accent][1]},
                ]}>
                <Icon
                  name={name}
                  size={26}
                  color={isSelected ? colors[accent][0] : colors[gray][1]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
        {/* Rellena la ultima fila para que no se estire al ancho completo. */}
        {Array.from({length: COLUMNS - item.names.length}).map((_, index) => (
          <View key={`filler-${index}`} style={styles.cell} />
        ))}
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeight="80%">
      <Text size={18} color={colors[secondary][1]} style={styles.title}>
        {t('icons.pickerTitle')}
      </Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('icons.searchPlaceholder')}
        placeholderTextColor={colors[gray][0]}
        accessibilityLabel={t('icons.searchPlaceholder')}
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.search}
      />
      {noResults ? (
        <Text color={colors[gray][1]} style={styles.empty}>
          {t('icons.noResults', {query: query.trim()})}
        </Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={row => row.key}
          renderItem={renderRow}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  title: {
    fontWeight: '700',
    marginBottom: 12,
  },
  search: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors[gray][0],
    paddingHorizontal: 15,
    color: colors[accent][2],
    backgroundColor: colors[white][0],
    marginBottom: 12,
  },
  // `flexShrink: 1` es obligatorio aqui: sin el, React Native no encoge la
  // lista bajo el `maxHeight` de la hoja y desborda en vez de hacer scroll.
  // Lo explica el comentario de `children` en `BottomSheet`.
  list: {
    flexShrink: 1,
  },
  heading: {
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    height: 62,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 30,
    textAlign: 'center',
  },
});

export default IconPicker;
