import {useCallback, useState} from 'react';
import {Money} from '@components/atoms/text/Money';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import VectorIcon from 'react-native-vector-icons/FontAwesome';

import {ScreenContainer} from '@components/atoms';
import {EntityMovementsPanel} from '@components/organisms/Lists/EntityMovementsPanel';
import {TextInput} from 'react-native';
import {
  QuickReturnHeader,
  useQuickReturnHeader,
} from '@components/molecules/Headers/QuickReturnHeader';
import {MainHeader} from '@components/molecules/Headers/MainHeader';
import {Text} from '@components/atoms/text/Text';
import {ConfirmDialog} from '@components/organisms/feedback';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {getDbConnection} from '@db/db';
import {archiveAccount, getAccounts, IAccountWithBalance} from '@db/queries';
import {accent, colors, gray, inactive, primary, secondary, white} from '@constants/colors/colors';
import {getKindLabel} from '../CreateAccount/partials/KindField/KindField';
import {AccountsAdminNavigationProp} from '@navigation/[accounts]/AccountsAdminNavigator/types';

type Status = 'loading' | 'success' | 'error';

/**
 * Administrar cuentas: listarlas, crearlas, editarlas y archivarlas.
 *
 * Vive en el menu lateral, junto a administrar categorias y por el mismo
 * reparto: las pestanas sirven para RECORRER los movimientos (por cuenta
 * o por categoria) y el menu lateral para MANTENER el catalogo. Aqui no
 * hay movimientos ni patrimonio neto — esas son preguntas de la pestana
 * Movimientos.
 *
 * Archivar y no borrar: una cuenta tiene movimientos con su historial y
 * sus saldos, asi que se oculta en vez de destruirse — ver
 * `archiveAccount`. Es la diferencia con las categorias, que si se
 * borran de verdad porque no guardan dinero.
 */
export const AccountsAdminScreen = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<AccountsAdminNavigationProp>();
  const {notice, showNotice, dismissNotice} = useNoticeDialog();

  const [accounts, setAccounts] = useState<IAccountWithBalance[]>([]);
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  // Con el buscador en uso la cabecera no se retira: esconder un campo
  // enfocado mientras se escribe deja al usuario tecleando a ciegas.
  const quickReturn = useQuickReturnHeader({
    locked: isSearchFocused || query.length > 0,
  });
  /** Una sola fila abierta a la vez — ver el mismo comentario en
   * `CategoriesAdminScreen`. */
  const [expandedId, setExpandedId] = useState<number>();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [archiveConfirm, setArchiveConfirm] = useState<{
    visible: boolean;
    account?: IAccountWithBalance;
  }>({visible: false});

  const confirmingAccount = archiveConfirm.account;

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const db = await getDbConnection();
      setAccounts(await getAccounts(db));
      setStatus('success');
    } catch (e: any) {
      setErrorMessage(
        t('accounts.loadAccountsError', {
          message: e?.message ?? t('common.unknownError'),
        }),
      );
      setStatus('error');
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const closeArchiveConfirm = () =>
    setArchiveConfirm(prev => ({...prev, visible: false}));

  const onConfirmArchive = async () => {
    if (!confirmingAccount) {
      return;
    }
    const account = confirmingAccount;
    closeArchiveConfirm();
    try {
      const db = await getDbConnection();
      await archiveAccount(db, account.id);
      await load();
    } catch {
      showNotice('danger', t('common.error'), t('accounts.archiveAccountErrorMessage'));
    }
  };

  // La busqueda normaliza acentos por los dos lados, igual que en
  // categorias.
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const needle = normalize(query.trim());
  const visibleAccounts =
    needle.length === 0
      ? accounts
      : accounts.filter(account => normalize(account.name).includes(needle));

  return (
    <ScreenContainer containerStyle={styles.screen}>
      {/* Dos lineas explicitas: `MainHeader` parte `title` por el primer
          espacio y tira lo que sobre — ver el comentario gemelo en
          `CategoriesAdminScreen`. */}
      <MainHeader
        title={t('accounts.adminHeaderTitle')}
        subtitle={t('accounts.adminHeaderSubtitle')}
      />
      <QuickReturnHeader controller={quickReturn}>
      <View style={styles.intro}>
        <View style={styles.searchBox}>
          <VectorIcon name="search" size={14} color={colors[gray][0]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('entityPicker.searchAccount')}
            placeholderTextColor={colors[gray][0]}
            style={styles.searchInput}
            autoCorrect={false}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            accessibilityLabel={t('entityPicker.searchAccount')}
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

        {/* Los dos accesos van ARRIBA, no al pie de la lista.
            Al pie funcionaban con cuatro cuentas; con la lista crecida
            —y mas ahora que las filas se despliegan con sus
            movimientos— quedaban a varias pantallas de scroll, que es
            tanto como no estar. Arriba se alcanzan siempre, y ademas
            "crear" es lo que uno viene a hacer a esta pantalla. */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('accounts.addAccount')}
            onPress={() => navigation.navigate('CreateAccount')}
            style={styles.addRow}>
            <VectorIcon name="plus" color={colors[primary][0]} size={16} />
            <Text color={colors[primary][0]} style={styles.addLabel}>
              {t('accounts.adminAddAccount')}
            </Text>
          </TouchableOpacity>

          {/* Las archivadas viven detras de esta pantalla, no en la
              pestana: ver una cuenta que ya no usas es una tarea de
              mantenimiento, no de consulta diaria. */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('accounts.archivedAccountsAccessibilityLabel')}
            onPress={() => navigation.navigate('ArchivedAccounts')}
            style={styles.archivedRow}>
            <Text size={13} color={colors[gray][0]}>
              {t('accounts.archivedAccounts')}
            </Text>
            <VectorIcon name="chevron-right" color={colors[gray][0]} size={14} />
          </TouchableOpacity>
        </View>
      </View>
      </QuickReturnHeader>

      {status === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={colors[accent][2]}
            accessibilityLabel={t('accounts.loadingAccounts')}
          />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.centered}>
          <Text color={colors[secondary][0]} style={styles.message}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('accounts.retryLoadingAccounts')}
            onPress={load}
            style={styles.retryButton}>
            <Text color={colors[white][0]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'success' && (
        <FlatList
          data={visibleAccounts}
          keyExtractor={item => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={quickReturn.onScroll}
          onContentSizeChange={quickReturn.onContentSizeChange}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <Text color={colors[gray][0]} style={styles.message}>
              {t('accounts.adminEmptyState')}
            </Text>
          }
          renderItem={({item}) => {
            const isExpanded = expandedId === item.id;
            return (
              <>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{expanded: isExpanded}}
              accessibilityLabel={t('accounts.toggleMovementsAccessibilityLabel', {
                name: item.name,
              })}
              onPress={() => setExpandedId(prev => (prev === item.id ? undefined : item.id))}
              style={styles.row}>
              <View style={styles.icon}>
                <VectorIcon name={item.icon} color={colors[white][0]} size={14} />
              </View>
              <View style={styles.rowText}>
                <Text numberOfLines={1}>{item.name}</Text>
                <Text size={12} color={colors[gray][0]}>
                  {getKindLabel(item.kind)} ·{' '}
                  <Text
                    size={12}
                    color={item.balance < 0 ? colors.error[0] : colors[gray][0]}>
                    {<Money cents={item.balance} fontSize={12} />}
                  </Text>
                </Text>
              </View>
              <VectorIcon
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                color={colors[gray][0]}
                size={12}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('accounts.editAccountAccessibilityLabel', {
                  name: item.name,
                })}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                onPress={() =>
                  navigation.navigate('EditAccount', {accountId: item.id})
                }
                style={styles.action}>
                <VectorIcon name="pencil" color={colors[gray][0]} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('accounts.archiveAccountAccessibilityLabel', {
                  name: item.name,
                })}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                onPress={() => setArchiveConfirm({visible: true, account: item})}
                style={styles.action}>
                <VectorIcon name="archive" color={colors[gray][0]} size={18} />
              </TouchableOpacity>
            </TouchableOpacity>
            {isExpanded && <EntityMovementsPanel idAccount={item.id} />}
              </>
            );
          }}
        />
      )}

      <ConfirmDialog
        visible={archiveConfirm.visible}
        tone="danger"
        title={t('accounts.archiveAccountTitle')}
        message={
          confirmingAccount
            ? t('accounts.archiveAccountMessage', {name: confirmingAccount.name})
            : ''
        }
        onRequestClose={closeArchiveConfirm}
        secondaryLabel={t('common.cancel')}
        onSecondaryPress={closeArchiveConfirm}
        primaryLabel={t('accounts.archive')}
        destructive
        onPrimaryPress={onConfirmArchive}
      />

      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={dismissNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={dismissNotice}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
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
  intro: {
    // `width: '100%'` explicito: `ScreenContainer` centra a sus hijos y
    // sin ancho el buscador se encoge a un cuadradito con la lupa.
    width: '100%',
    // Sin sangria propia: `ScreenContainer` ya aplica 15 a todo lo que
    // envuelve. Los 15 de aqui se SUMABAN a esos, dejando 30 por lado y
    // estrechando la lista sin motivo.
    marginBottom: 8,
  },
  screen: {
    // `paddingBottom: 0` anula los 32 que `ScreenContainer` pone a todo
    // lo que envuelve. Esos 32 quedaban FUERA de la lista: un hueco
    // muerto bajo el area desplazable, que recortaba el alto util sin
    // dar aire al final del contenido. El mismo espacio vive ahora
    // DENTRO, en `listContent`, donde si se desplaza con las filas y
    // solo se ve al llegar al final.
    //
    // Aqui es seguro quitarlos: esos 32 existen en `ScreenContainer`
    // para que el ultimo elemento no quede bajo el FAB, y estas
    // pantallas cuelgan del menu lateral, fuera del navegador de
    // pestanas que lo dibuja.
    paddingBottom: 0,
    // `flex: 1` en el contenedor y en la lista.
    //
    // `ScreenContainer` NO acota su alto —no lleva `flex: 1`, y lo usan
    // otras 13 pantallas, asi que no se le pone alli—, de modo que
    // crecia hasta lo que midiera la lista y el final se salia de la
    // pantalla: el ultimo elemento quedaba cortado y el scroll ya no
    // podia traerlo, porque para la lista ya estaba en su tope. Medido:
    // la ultima fila se dibujaba de 2202 a 2274 cuando mide 169.
    flex: 1,
  },
  list: {
    width: '100%',
    flex: 1,
  },
  listContent: {
    // Sin sangria propia: `ScreenContainer` ya aplica 15 a todo lo que
    // envuelve. Los 15 de aqui se SUMABAN a esos, dejando 30 por lado y
    // estrechando la lista sin motivo.
    paddingTop: 12,
    paddingBottom: 72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors[white][0],
    marginBottom: 8,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors[primary][0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  action: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 30,
  },
  message: {
    paddingHorizontal: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    height: 44,
    minWidth: 120,
    borderRadius: 10,
    backgroundColor: colors[secondary][0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRow: {
    // `flex: 1` para repartirse la fila con "Cuentas archivadas": antes
    // era una fila propia a todo el ancho al pie de la lista, y al
    // subirla se encogia al ancho de su texto.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors[inactive][0],
  },
  addLabel: {
    marginLeft: 8,
    fontWeight: '600',
  },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // `gap` en vez de `space-between`: repartir el espacio solo separa
    // texto y chevron cuando la fila ocupa todo el ancho. Al subirla
    // junto a "Nueva cuenta" la fila mide lo que su contenido, asi que
    // el chevron quedaba pegado a la ultima letra.
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
});

export default AccountsAdminScreen;
