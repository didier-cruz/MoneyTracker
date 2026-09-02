import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {ScreenContainer, KeyboardContainer, Spacer} from '@components/atoms';
import {ConfirmDialog} from '@components/organisms/feedback';
import {useAccountForm} from '@hooks/useAccountForm';
import {ScrollView} from 'react-native-gesture-handler';
import Header from '@screens/[categories]/components/Header/Header';
import InputField from '@screens/[categories]/CreateCategory/partials/InputField/InputField';
import SymbolList from '@screens/[categories]/CreateCategory/partials/SymbolList/SymbolList';
import SaveAction from '@screens/[categories]/CreateCategory/partials/SaveAction/SaveAction';
import KindField from './partials/KindField/KindField';
import {AccountsNavParams} from '@navigation/[accounts]/AccountsNavigator/types';
import {accent, colors, secondary, white} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';

/**
 * Deliberately NOT `NativeStackScreenProps<AccountsNavParams,
 * 'CreateAccount' | 'EditAccount'>` — `RouteProp`'s generic isn't a
 * distributive conditional type, so passing it a union `RouteName`
 * collapses `route.params` into `undefined | {accountId: number}`
 * WITHOUT tying either shape to a matching `route.name`, and
 * `route.name === 'EditAccount'` can't narrow it. Union-ing two
 * separately-resolved `RouteProp`s instead keeps `name`/`params` paired
 * per branch, so that same check narrows correctly below.
 */
type CreateAccountProps = {
  navigation: NativeStackNavigationProp<
    AccountsNavParams,
    'CreateAccount' | 'EditAccount'
  >;
  route:
    | RouteProp<AccountsNavParams, 'CreateAccount'>
    | RouteProp<AccountsNavParams, 'EditAccount'>;
};

/**
 * Not part of the approved prototype (see this screen's HANDOFF note) —
 * built by reusing `CreateCategory`'s already-approved pattern
 * (`InputField`/`SymbolList`/`SaveAction` verbatim; only `KindField`,
 * the account-kind selector, is new — `categories`' `RadioField`
 * hardcodes `CATEGORY_TYPES`' two values, `accounts` has four).
 *
 * Doubles as the "edit account" screen: registered under BOTH the
 * `CreateAccount` route (no params) and `EditAccount` route
 * (`{accountId}`) in `AccountsNavigator`. `route.name` tells the two
 * apart; `useAccountForm(accountId)` does the rest (prefills every
 * field from the existing account, calls `updateAccount` instead of
 * `insertAccount` on save) — see that hook's doc comment. Editing is
 * the same form as creating in every way that matters (fields,
 * validation, icon/kind pickers), so extending this screen instead of
 * writing a near-duplicate one keeps that logic in one place.
 */
export const CreateAccount = ({navigation, route}: CreateAccountProps) => {
  const {t} = useTranslation();
  const accountId =
    route.name === 'EditAccount' ? route.params.accountId : undefined;
  const isEditMode = accountId !== undefined;

  const {
    inputText,
    onChangeInputText,
    selectedIcon,
    handlePressItem,
    selectedKind,
    onChangeSelectedKind,
    initialBalanceText,
    onChangeInitialBalanceText,
    nameError,
    amountError,
    formError,
    canSave,
    saveAccount,
    loadStatus,
    loadErrorMessage,
    reloadAccount,
    notice,
    dismissNotice,
  } = useAccountForm(accountId);

  // Was `Alert.alert(...); navigation.goBack()` fired back to back —
  // the native `Alert` rendered outside the React tree, so it stayed on
  // screen even once `goBack()` popped this one underneath it. A
  // JS-rendered `ConfirmDialog` would instead unmount WITH this screen,
  // so navigation now waits for the dialog's own dismissal instead (see
  // `onDismissSavedNotice`).
  const handleSave = async () => {
    await saveAccount();
  };

  const onDismissSavedNotice = () => {
    dismissNotice();
    navigation.goBack();
  };

  // Edit mode needs a real DB read (`getAccountById`) before the form
  // has anything to show — full lifecycle (loading/error, with retry)
  // same as every other async screen in this app, not just "create".
  if (isEditMode && loadStatus === 'loading') {
    return (
      <KeyboardContainer>
        <ScreenContainer>
          <Header title={t('accounts.editAccountTitle')} />
          <View style={stateStyles.centered}>
            <ActivityIndicator
              size="large"
              color={colors[accent][2]}
              accessibilityLabel={t('accounts.loadingAccount')}
            />
          </View>
        </ScreenContainer>
      </KeyboardContainer>
    );
  }

  if (isEditMode && loadStatus === 'error') {
    return (
      <KeyboardContainer>
        <ScreenContainer>
          <Header title={t('accounts.editAccountTitle')} />
          <View style={stateStyles.centered}>
            <Text color={colors[secondary][0]} style={stateStyles.message}>
              {loadErrorMessage}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('accounts.retryLoadingAccount')}
              onPress={reloadAccount}
              style={stateStyles.retryButton}>
              <Text color={colors[white][0]}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        </ScreenContainer>
      </KeyboardContainer>
    );
  }

  return (
    <>
      <KeyboardContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenContainer>
            <Header
              title={
                isEditMode ? t('accounts.editAccountTitle') : t('accounts.createAccountTitle')
              }
              message={isEditMode ? undefined : t('accounts.createAccountMessage')}
            />
            <InputField
              inputText={inputText}
              onChangeInputText={onChangeInputText}
              placeholder={t('accounts.accountNamePlaceholder')}
              accessibilityLabel={t('accounts.accountNamePlaceholder')}
              error={nameError}
            />
            <Spacer space={20} />
            <KindField value={selectedKind} onChange={onChangeSelectedKind} />
            <Spacer space={20} />
            <InputField
              inputText={initialBalanceText}
              onChangeInputText={onChangeInitialBalanceText}
              placeholder={t('accounts.initialBalancePlaceholder')}
              accessibilityLabel={t('accounts.initialBalanceAccessibilityLabel')}
              keyboardType="decimal-pad"
              error={amountError}
            />
            <SymbolList selectedIcon={selectedIcon} onPressItem={handlePressItem} />
            <Spacer space={20} />
            {formError !== '' && (
              <Text
                color={colors[secondary][0]}
                style={stateStyles.formError}
                accessibilityLiveRegion="polite">
                {formError}
              </Text>
            )}
            <SaveAction onSave={handleSave} disabled={!canSave} />
            <Spacer space={30} />
          </ScreenContainer>
        </ScrollView>
      </KeyboardContainer>

      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={onDismissSavedNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={onDismissSavedNotice}
      />
    </>
  );
};

const stateStyles = StyleSheet.create({
  centered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  message: {
    paddingHorizontal: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  // Los errores que no cuelgan de ningun input —falta el icono, fallo
  // al guardar— se pintan aqui, junto al boton que los provoca.
  formError: {
    paddingHorizontal: 20,
    marginBottom: 10,
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
});
