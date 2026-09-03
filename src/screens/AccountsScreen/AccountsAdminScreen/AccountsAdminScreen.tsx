import {useCallback, useState} from 'react';
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
import {MainHeader} from '@components/molecules/Headers/MainHeader';
import {Text} from '@components/atoms/text/Text';
import {ConfirmDialog} from '@components/organisms/feedback';
import {useNoticeDialog} from '@hooks/useNoticeDialog';
import {getDbConnection} from '@db/db';
import {archiveAccount, getAccounts, IAccountWithBalance} from '@db/queries';
import {formatCentsToCurrency} from '@utils/currency';
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

  return (
    <ScreenContainer>
      <MainHeader title={t('accounts.adminTitle')} />
      <View style={styles.intro}>
        <Text color={colors[gray][0]}>{t('accounts.adminMessage')}</Text>
      </View>

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
          data={accounts}
          keyExtractor={item => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text color={colors[gray][0]} style={styles.message}>
              {t('accounts.adminEmptyState')}
            </Text>
          }
          renderItem={({item}) => (
            <View style={styles.row}>
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
                    {formatCentsToCurrency(item.balance)}
                  </Text>
                </Text>
              </View>
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
            </View>
          )}
          ListFooterComponent={
            <>
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
                <Text color={colors[gray][0]}>{t('accounts.archivedAccounts')}</Text>
                <VectorIcon name="chevron-right" color={colors[gray][0]} size={14} />
              </TouchableOpacity>
            </>
          }
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
  intro: {
    paddingHorizontal: 15,
    marginBottom: 4,
  },
  list: {
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 40,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
    justifyContent: 'space-between',
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
});

export default AccountsAdminScreen;
