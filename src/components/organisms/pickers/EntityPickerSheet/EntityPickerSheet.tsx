import {FC, useMemo, useState} from 'react';
import {Money} from '@components/atoms/text/Money';
import {FlatList, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {useTranslation} from 'react-i18next';

import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
import {BottomSheet} from '@components/organisms/feedback';
import {EntityMovementsPanel} from '@components/organisms/Lists/EntityMovementsPanel';
import {colors, gray, primary, white} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';

export interface EntityPickerItem {
  id: number;
  name: string;
  /** Nombre de icono de FontAwesome 4.7. */
  icon: string;
  /** Centavos con signo: el gasto del mes de una categoria o el saldo de
   * una cuenta. */
  amount: number;
}

export interface EntityPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** "Listado de Categorias y sus Movimientos" / "...de Cuentas...". El
   * titulo ES el que dice que se esta mirando: dentro de la hoja no hay
   * pestanas para cambiar de una cosa a otra, se abre ya en su
   * contexto. */
  title: string;
  searchPlaceholder: string;
  items: EntityPickerItem[];
  selectedId?: number;
  onSelect: (id: number) => void;
  /**
   * Que representa cada fila. Decide si el desplegable pide los
   * movimientos por categoria o por cuenta — son dos filtros distintos
   * de `getFinances`, no hay forma de deducirlo del `id`.
   */
  entity: 'category' | 'account';
}

/**
 * Hoja con el listado COMPLETO de categorias o de cuentas, con buscador.
 *
 * Existe porque la fila horizontal de Movimientos se corta en ocho
 * tarjetas: con 19 categorias eran casi nueve pantallas de
 * desplazamiento. Aqui esta el resto, y elegir una la selecciona y
 * cierra, dejando sus movimientos abajo en la pantalla que sigue viva
 * detras.
 *
 * Un solo componente para las dos entidades — solo cambian el titulo,
 * el placeholder y los datos — porque las dos mitades de Movimientos
 * hacen literalmente lo mismo: elegir un elemento para ver sus
 * movimientos.
 *
 * La busqueda normaliza acentos por los dos lados: sin eso, escribir
 * "educacion" no encontraria "Educación", que es como se llama la
 * categoria sembrada por defecto.
 */
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const EntityPickerSheet: FC<EntityPickerSheetProps> = ({
  visible,
  onClose,
  title,
  searchPlaceholder,
  items,
  selectedId,
  onSelect,
  entity,
}) => {
  const {t} = useTranslation();
  const [query, setQuery] = useState('');
  /** Una sola fila desplegada a la vez, igual que en las pantallas del
   * menu lateral: cada despliegue lanza su consulta de movimientos. */
  const [expandedId, setExpandedId] = useState<number>();

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (needle.length === 0) {
      return items;
    }
    return items.filter(item => normalize(item.name).includes(needle));
  }, [items, query]);

  const handleSelect = (id: number) => {
    setQuery('');
    setExpandedId(undefined);
    onSelect(id);
    onClose();
  };

  const handleClose = () => {
    setQuery('');
    setExpandedId(undefined);
    onClose();
  };

  // El encabezado se pasa como ELEMENTO, no como funcion: una funcion
  // se vuelve a montar en cada render y el `TextInput` perderia el foco
  // a la primera letra. Es la misma trampa documentada en
  // `ScrollContainer`.
  const header = (
    <View style={styles.header}>
      <Title level={4} style={styles.title}>
        {title}
      </Title>
      <View style={styles.searchBox}>
        <VectorIcon name="search" size={14} color={colors[gray][0]} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors[gray][0]}
          style={styles.searchInput}
          autoCorrect={false}
          accessibilityLabel={searchPlaceholder}
        />
        {query.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.clear')}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={() => setQuery('')}>
            <VectorIcon name="times-circle" size={16} color={colors[gray][0]} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      maxHeight="80%"
      // `BottomSheet` no trae sangria lateral propia: el titulo y las
      // filas salian pegados al borde izquierdo del panel. Mismo
      // remedio que ya llevaba `IconPicker`.
      contentStyle={styles.sheet}>
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        // `flexShrink: 1` es obligatorio bajo `BottomSheet`: sin el, RN
        // no encoge la lista contra el `maxHeight` de la hoja y en vez
        // de desplazarse se derrama por debajo del panel.
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text color={colors[gray][0]} align="center" style={styles.empty}>
            {t('entityPicker.noResults', {query: query.trim()})}
          </Text>
        }
        renderItem={({item}) => {
          const isSelected = item.id === selectedId;
          const isExpanded = expandedId === item.id;
          return (
            <>
              {/* Dos gestos distintos en la misma fila, a proposito:
                  TOCAR LA FILA elige y cierra —que es para lo que se
                  abre esta hoja—, y el CHEVRON despliega los movimientos
                  sin salir de aqui. Asi el titulo "…y sus Movimientos"
                  deja de ser una promesa vacia: antes solo se listaban
                  los nombres y los movimientos habia que adivinarlos
                  eligiendo a ciegas. */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{selected: isSelected}}
                accessibilityLabel={t('entityPicker.rowAccessibilityLabel', {
                  name: item.name,
                  amount: formatCentsToCurrency(item.amount),
                })}
                activeOpacity={0.7}
                onPress={() => handleSelect(item.id)}
                style={[styles.row, isSelected && styles.rowSelected]}>
                <View style={styles.rowIcon}>
                  <VectorIcon name={item.icon} size={16} color={colors[white][0]} />
                </View>
                <Text size={14} lines={1} style={styles.rowName}>
                  {item.name}
                </Text>
                <Text size={13} color={colors[gray][0]}>
                  {<Money cents={item.amount} fontSize={13} />}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{expanded: isExpanded}}
                  accessibilityLabel={t('entityPicker.toggleMovements', {
                    name: item.name,
                  })}
                  hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
                  onPress={() =>
                    setExpandedId(prev => (prev === item.id ? undefined : item.id))
                  }
                  style={styles.rowChevron}>
                  <VectorIcon
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={colors[gray][0]}
                  />
                </TouchableOpacity>
              </TouchableOpacity>

              {isExpanded && (
                <EntityMovementsPanel
                  idCategory={entity === 'category' ? item.id : undefined}
                  idAccount={entity === 'account' ? item.id : undefined}
                />
              )}
            </>
          );
        }}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  // La hoja NO lleva sangria lateral: si la lleva, la `FlatList` entera
  // se mete 20 hacia dentro y la barra de desplazamiento se dibuja en el
  // borde de la LISTA, despegada del borde del panel. La sangria va en
  // el contenido, asi el texto queda metido y la barra pegada al canto.
  sheet: {
    paddingHorizontal: 0,
  },
  list: {
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  header: {
    backgroundColor: colors[white][0],
    paddingBottom: 10,
  },
  title: {
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface[0],
    borderWidth: 1,
    borderColor: colors.inactive[0],
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 14,
    color: colors[gray][1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 52,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowSelected: {
    backgroundColor: `${colors[primary][0]}14`,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors[primary][0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowName: {
    flex: 1,
  },
  rowChevron: {
    paddingLeft: 10,
  },
  empty: {
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
});

export default EntityPickerSheet;
