import {FC, useMemo, useState} from 'react';
import {FlatList, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import VectorIcon from 'react-native-vector-icons/FontAwesome';

import {BottomSheet} from '@components/organisms/feedback';
import {Text} from '@components/atoms/text/Text';
import {accent, colors, gray, primary, white} from '@constants/colors/colors';
import {Filters} from '../useAllMovements';
import {TimeRange} from '../mappers';

type Option = {label: string; value: string};
type Field = 'range' | 'account' | 'category';

type FiltersSheetProps = {
  visible: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClear: () => void;
  accountOptions: Option[];
  categoryOptions: Option[];
  rangeOptions: Option[];
};

/**
 * Los tres filtros como selectores CON BUSQUEDA, en una hoja inferior.
 *
 * Los chips que habia en la pantalla no escalaban: con veinte
 * categorias la fila se vuelve un carrusel donde encontrar una concreta
 * cuesta mas que escribirla. La pantalla se queda solo con los filtros
 * YA APLICADOS y elegirlos se hace aqui.
 *
 * ## Por que no se usa el `Select` de la libreria
 *
 * El encargo pedia "un react-select". `react-select` es de web y no
 * corre en React Native; su equivalente,
 * `@mobile-reality/react-native-select-pro`, ya estaba en el proyecto y
 * soporta `searchable`, asi que fue el primer intento. NO FUNCIONA aqui:
 * ese componente posiciona su lista de opciones en absoluto respecto al
 * control, y dentro de una hoja —un `Modal` con la altura acotada— la
 * lista se recorta y no se ve ninguna opcion. Comprobado en el
 * emulador: el control se abre, el chevron gira, la lista no aparece.
 *
 * Asi que la hoja CAMBIA DE VISTA en vez de desplegar nada: al tocar un
 * campo, su contenido se sustituye por el buscador y la lista de ese
 * campo, con una flecha para volver. Una sola hoja, dos estados, sin
 * modales anidados ni posicionamiento absoluto que se pueda recortar.
 * Es el mismo patron del selector de iconos, que ya funciona.
 */
export const FiltersSheet: FC<FiltersSheetProps> = ({
  visible,
  onClose,
  filters,
  onChange,
  onClear,
  accountOptions,
  categoryOptions,
  rangeOptions,
}) => {
  const {t} = useTranslation();
  const [openField, setOpenField] = useState<Field | null>(null);
  const [query, setQuery] = useState('');

  const fields: {
    key: Field;
    label: string;
    options: Option[];
    value: string;
    apply: (value: string) => void;
  }[] = [
    {
      key: 'range',
      label: t('allMovements.periodLabel'),
      options: rangeOptions,
      value: filters.range,
      apply: value => onChange('range', value as TimeRange),
    },
    {
      key: 'account',
      label: t('allMovements.accountLabel'),
      options: accountOptions,
      value: String(filters.accountId),
      apply: value => onChange('accountId', value === 'all' ? 'all' : Number(value)),
    },
    {
      key: 'category',
      label: t('allMovements.categoryLabel'),
      options: categoryOptions,
      value: String(filters.categoryId),
      apply: value => onChange('categoryId', value === 'all' ? 'all' : Number(value)),
    },
  ];

  const active = fields.find(field => field.key === openField);

  const results = useMemo(() => {
    if (!active) {
      return [];
    }
    const needle = query
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    if (needle === '') {
      return active.options;
    }
    return active.options.filter(option =>
      option.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .includes(needle),
    );
  }, [active, query]);

  const closeField = () => {
    setOpenField(null);
    setQuery('');
  };

  const handleClose = () => {
    closeField();
    onClose();
  };

  const labelFor = (options: Option[], value: string) =>
    options.find(option => option.value === value)?.label ?? '';

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      maxHeight="85%"
      contentStyle={styles.sheet}>
      {active ? (
        <>
          <View style={styles.fieldHeader}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
              onPress={closeField}
              style={styles.backButton}>
              <VectorIcon name="chevron-left" size={18} color={colors[gray][1]} />
            </TouchableOpacity>
            <Text size={18} color={colors.text[1]} style={styles.title}>
              {active.label}
            </Text>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('allMovements.searchPlaceholder')}
            placeholderTextColor={colors[gray][0]}
            accessibilityLabel={t('allMovements.searchPlaceholder')}
            autoCorrect={false}
            style={styles.search}
          />

          {results.length === 0 ? (
            <Text color={colors[gray][0]} style={styles.empty}>
              {t('allMovements.noOptions')}
            </Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={option => option.value}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => {
                const isSelected = item.value === active.value;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{selected: isSelected}}
                    onPress={() => {
                      active.apply(item.value);
                      closeField();
                    }}
                    style={[styles.option, isSelected && styles.optionSelected]}>
                    <Text color={isSelected ? colors[accent][0] : undefined}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <VectorIcon name="check" size={14} color={colors[accent][0]} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      ) : (
        <>
          <Text size={18} color={colors.text[1]} style={styles.title}>
            {t('allMovements.filtersTitle')}
          </Text>

          {fields.map(field => (
            <TouchableOpacity
              key={field.key}
              accessibilityRole="button"
              accessibilityLabel={`${field.label}: ${labelFor(field.options, field.value)}`}
              onPress={() => setOpenField(field.key)}
              style={styles.field}>
              <View style={styles.fieldText}>
                <Text size={12} color={colors[gray][0]} style={styles.fieldLabel}>
                  {field.label}
                </Text>
                <Text numberOfLines={1}>{labelFor(field.options, field.value)}</Text>
              </View>
              <VectorIcon name="chevron-right" size={14} color={colors[gray][0]} />
            </TouchableOpacity>
          ))}

          <View style={styles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('allMovements.clearFilters')}
              onPress={onClear}
              style={styles.secondaryAction}>
              <Text color={colors[gray][0]}>{t('allMovements.clearFilters')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('allMovements.applyFilters')}
              onPress={handleClose}
              style={styles.primaryAction}>
              <Text color={colors[primary][0]} style={styles.primaryLabel}>
                {t('allMovements.applyFilters')}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
  },
  title: {
    fontWeight: '700',
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
    marginBottom: 16,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inactive[0],
    marginBottom: 10,
  },
  fieldText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 10,
  },
  fieldLabel: {
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
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
  // `flexShrink: 1` es obligatorio para que la lista encoja bajo el
  // `maxHeight` de la hoja en vez de desbordar — ver `BottomSheet`.
  list: {
    flexShrink: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  optionSelected: {
    backgroundColor: colors[primary][0],
  },
  empty: {
    paddingVertical: 30,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  secondaryAction: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  primaryAction: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors[accent][0],
  },
  primaryLabel: {
    fontWeight: '700',
  },
});

export default FiltersSheet;
