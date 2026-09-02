import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {ScreenContainer, KeyboardContainer, Spacer} from '@components/atoms';
import {ConfirmDialog} from '@components/organisms/feedback';
import {useEnvelopeForm} from '@hooks/useEnvelopeForm';
import {ScrollView} from 'react-native-gesture-handler';
import Header from '@screens/[categories]/components/Header/Header';
import InputField from '@screens/[categories]/CreateCategory/partials/InputField/InputField';
import SymbolList from '@screens/[categories]/CreateCategory/partials/SymbolList/SymbolList';
import SaveAction from '@screens/[categories]/CreateCategory/partials/SaveAction/SaveAction';
import KindField from './partials/KindField/KindField';
import {BudgetsNavParams} from '@navigation/[budgets]/BudgetsNavigator/types';
import {accent, colors, secondary, white} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';

/**
 * Same `RouteProp` union trick `CreateAccount` uses (see that screen's
 * doc comment for why a single `NativeStackScreenProps<BudgetsNavParams,
 * 'CreateEnvelope' | 'EditEnvelope'>` can't be used here instead —
 * `RouteProp`'s generic isn't distributive over a union `RouteName`).
 */
type CreateEnvelopeProps = {
  navigation: NativeStackNavigationProp<
    BudgetsNavParams,
    'CreateEnvelope' | 'EditEnvelope'
  >;
  route:
    | RouteProp<BudgetsNavParams, 'CreateEnvelope'>
    | RouteProp<BudgetsNavParams, 'EditEnvelope'>;
};

/**
 * Not part of the approved `BudgetsScreen` prototype (that mock only
 * shows the envelope cards/limits list, not a create/edit form) — built
 * by reusing `CreateCategory`'s already-approved
 * `InputField`/`SymbolList`/`SaveAction` pattern verbatim, exactly like
 * `CreateAccount` already does; only `KindField` (fund/debt selector,
 * locked in edit mode) is new here.
 *
 * Doubles as the "edit envelope" screen, registered under BOTH the
 * `CreateEnvelope` (no params) and `EditEnvelope` (`{envelopeId}`)
 * routes in `BudgetsNavigator` — `route.name` tells the two apart, same
 * shape as `CreateAccount`/`EditAccount`.
 */
export const CreateEnvelope = ({navigation, route}: CreateEnvelopeProps) => {
  const {t} = useTranslation();
  const envelopeId =
    route.name === 'EditEnvelope' ? route.params.envelopeId : undefined;
  const isEditMode = envelopeId !== undefined;

  const {
    inputText,
    onChangeInputText,
    selectedIcon,
    handlePressItem,
    selectedKind,
    onChangeSelectedKind,
    targetAmountText,
    onChangeTargetAmountText,
    nameError,
    amountError,
    formError,
    canSave,
    saveEnvelope,
    loadStatus,
    loadErrorMessage,
    reloadEnvelope,
    notice,
    dismissNotice,
  } = useEnvelopeForm(envelopeId);

  // Same fix as `CreateAccount` — see that screen's doc comment: the
  // native `Alert.alert` this used to fire stayed on screen even after
  // an immediate `navigation.goBack()` because it rendered outside the
  // React tree; a JS `ConfirmDialog` would unmount WITH this screen, so
  // navigation now waits for the dialog's own dismissal instead.
  const handleSave = async () => {
    await saveEnvelope();
  };

  const onDismissSavedNotice = () => {
    dismissNotice();
    navigation.goBack();
  };

  const targetAmountPlaceholder =
    selectedKind === 'debt'
      ? t('budgets.amountOwedPlaceholder')
      : t('budgets.savingsGoalPlaceholder');

  if (isEditMode && loadStatus === 'loading') {
    return (
      <KeyboardContainer>
        <ScreenContainer>
          <Header title={t('budgets.editEnvelopeTitle')} />
          <View style={stateStyles.centered}>
            <ActivityIndicator
              size="large"
              color={colors[accent][2]}
              accessibilityLabel={t('budgets.loadingEnvelope')}
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
          <Header title={t('budgets.editEnvelopeTitle')} />
          <View style={stateStyles.centered}>
            <Text color={colors[secondary][0]} style={stateStyles.message}>
              {loadErrorMessage}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('budgets.retryLoadingEnvelope')}
              onPress={reloadEnvelope}
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
                isEditMode ? t('budgets.editEnvelopeTitle') : t('budgets.createEnvelopeTitle')
              }
              message={isEditMode ? undefined : t('budgets.createEnvelopeMessage')}
            />
            <InputField
              inputText={inputText}
              onChangeInputText={onChangeInputText}
              placeholder={t('budgets.envelopeNamePlaceholder')}
              accessibilityLabel={t('budgets.envelopeNamePlaceholder')}
              error={nameError}
            />
            <Spacer space={20} />
            <KindField
              value={selectedKind}
              onChange={isEditMode ? undefined : onChangeSelectedKind}
            />
            <Spacer space={20} />
            <InputField
              inputText={targetAmountText}
              onChangeInputText={onChangeTargetAmountText}
              placeholder={targetAmountPlaceholder}
              accessibilityLabel={
                selectedKind === 'debt'
                  ? t('budgets.amountOwedAccessibilityLabel')
                  : t('budgets.savingsGoalAccessibilityLabel')
              }
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
