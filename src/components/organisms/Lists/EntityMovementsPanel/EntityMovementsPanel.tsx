import {FC, useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';

import {Text} from '@components/atoms/text/Text';
import {TransactItem} from '@components/atoms/items/TransactItem';
import {getDbConnection} from '@db/db';
import {getFinances, IFinanceRow} from '@db/queries';
import {mapFinanceRowToTransactItem} from '@screens/ResumenScreen/mappers';
import {accent, colors, gray, secondary} from '@constants/colors/colors';

/** Cuantos movimientos se asoman al desplegar una fila. */
const PREVIEW_SIZE = 3;

export interface EntityMovementsPanelProps {
  /** Uno de los dos, nunca los dos: esta fila es de una categoria O de
   * una cuenta. */
  idCategory?: number;
  idAccount?: number;
  /** Abre la pantalla de todos los movimientos ya filtrada. Opcional:
   * un anfitrion sin esa ruta registrada en su stack simplemente no
   * pinta el enlace, en vez de ofrecer un boton que reventaria al
   * pulsarlo. */
  onPressSeeAll?: () => void;
}

/**
 * Los ultimos movimientos de UNA categoria o UNA cuenta, para
 * desplegarse bajo su fila en las pantallas del menu lateral.
 *
 * Consulta al montarse, y solo se monta cuando su fila se despliega:
 * las pantallas que lo usan mantienen una sola fila abierta a la vez,
 * asi que nunca hay mas de una consulta viva. Es a proposito lo
 * contrario de lo que hace `useAnalysisScreen`, que lanza una consulta
 * por elemento en cada foco y esta anotado como algo que no repetir.
 */
export const EntityMovementsPanel: FC<EntityMovementsPanelProps> = ({
  idCategory,
  idAccount,
  onPressSeeAll,
}) => {
  const {t} = useTranslation();
  const [rows, setRows] = useState<IFinanceRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const db = await getDbConnection();
      const result = await getFinances(db, {
        idCategory,
        idAccount,
        limit: PREVIEW_SIZE,
      });
      setRows(result.items);
      setStatus('success');
    } catch (e: any) {
      console.warn('[EntityMovementsPanel] load failed:', e?.message ?? e);
      setStatus('error');
    }
  }, [idCategory, idAccount]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.panel}>
      {status === 'loading' && (
        <ActivityIndicator
          color={colors[accent][2]}
          accessibilityLabel={t('common.loading')}
          style={styles.spinner}
        />
      )}

      {status === 'error' && (
        <TouchableOpacity accessibilityRole="button" onPress={load} style={styles.retry}>
          <Text size={12} color={colors[secondary][0]}>
            {t('common.retry')}
          </Text>
        </TouchableOpacity>
      )}

      {status === 'success' && rows.length === 0 && (
        <Text size={12} color={colors[gray][0]} style={styles.empty}>
          {t('entityPicker.noMovementsYet')}
        </Text>
      )}

      {status === 'success' &&
        rows.map(row => (
          <TransactItem key={row.id} {...mapFinanceRowToTransactItem(row)} compact />
        ))}

      {status === 'success' && rows.length > 0 && onPressSeeAll && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('entityPicker.seeAllMovements')}
          onPress={onPressSeeAll}
          style={styles.seeAll}>
          <Text size={12} color={colors[accent][2]}>
            {t('entityPicker.seeAllMovements')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    // Sangrado bajo la fila que lo abre: la linea vertical y el margen
    // izquierdo dicen "esto cuelga de la de arriba" sin necesidad de
    // repetir su nombre.
    marginLeft: 34,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.inactive[0],
    marginBottom: 6,
  },
  spinner: {
    alignSelf: 'flex-start',
    marginVertical: 10,
  },
  retry: {
    paddingVertical: 10,
  },
  empty: {
    paddingVertical: 10,
  },
  seeAll: {
    paddingVertical: 8,
  },
});

export default EntityMovementsPanel;
