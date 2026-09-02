import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {ActivityIndicator, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {ScreenContainer, KeyboardContainer, Spacer} from '@components/atoms';
import {colors, secondary, white, accent} from '@constants/colors/colors';
import {ConfirmDialog} from '@components/organisms/feedback';
import {useCategoryForm} from '@hooks/useCategoryForm';
import {InputField, SymbolList, SaveAction, RadioField} from './partials';
import {ScrollView} from 'react-native-gesture-handler';
import Header from '../components/Header/Header';
import {CategoriesNavParams} from '@navigation/[categories]/CategoriesNavigator/types';
import {useTranslation} from 'react-i18next';

/**
 * Misma union de `RouteProp` que usan `CreateAccount` y
 * `CreateEnvelope` — ver el comentario de aquella para por que no sirve
 * un solo `NativeStackScreenProps` con un `RouteName` en union.
 */
type CreateCategoryProps = {
  navigation: NativeStackNavigationProp<
    CategoriesNavParams,
    'CreateCategory' | 'EditCategory'
  >;
  route:
    | RouteProp<CategoriesNavParams, 'CreateCategory'>
    | RouteProp<CategoriesNavParams, 'EditCategory'>;
};

//TODO: posibility to implement formik if needed
/**
 * Crear categoria y, bajo la ruta `EditCategory`, editarla — igual que
 * `CreateAccount` hace de doble para `EditAccount`. `route.name`
 * distingue los dos casos.
 */
export const CreateCategory = ({navigation, route}: CreateCategoryProps) => {
  const {t} = useTranslation();
  const categoryId =
    route.name === 'EditCategory' ? route.params.categoryId : undefined;
  const isEditMode = categoryId !== undefined;
  const {
    loadStatus,
    loadErrorMessage,
    reloadCategory,
    inputText,
    onChangeInputText,
    selectedIcon,
    selectedType,
    onChangeSelectedType,
    error,
    canSave,
    createCategory,
    handlePressItem,
    notice,
    dismissNotice,
  } = useCategoryForm(categoryId);

  // Al crear, la pantalla se queda abierta para anadir otra categoria.
  // Al editar no tiene sentido: ya no hay nada mas que editar aqui, asi
  // que al cerrar el aviso se vuelve al listado.
  const onDismissNotice = () => {
    dismissNotice();
    if (isEditMode) {
      navigation.goBack();
    }
  };

  if (isEditMode && loadStatus === 'loading') {
    return (
      <KeyboardContainer>
        <ScreenContainer>
          <Header title={t('categories.editCategoryTitle')} />
          <View style={stateStyles.centered}>
            <ActivityIndicator
              size="large"
              color={colors[accent][2]}
              accessibilityLabel={t('categories.loadingCategory')}
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
          <Header title={t('categories.editCategoryTitle')} />
          <View style={stateStyles.centered}>
            <Text color={colors[secondary][0]} style={stateStyles.message}>
              {loadErrorMessage}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('categories.retryLoadingCategory')}
              onPress={reloadCategory}
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
                isEditMode
                  ? t('categories.editCategoryTitle')
                  : t('categories.createCategoryTitle')
              }
              message={
                isEditMode ? undefined : t('categories.createCategoryMessage')
              }
            />
            <InputField
              inputText={inputText}
              onChangeInputText={onChangeInputText}
              error={error}
            />
            <Spacer space={20} />
            <RadioField value={selectedType} onChange={onChangeSelectedType} />
            <SymbolList
              selectedIcon={selectedIcon}
              onPressItem={handlePressItem}
            />
            <Spacer space={20} />
            <SaveAction onSave={createCategory} disabled={!canSave} />
            <Spacer space={30} />
          </ScreenContainer>
        </ScrollView>
      </KeyboardContainer>

      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={onDismissNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={onDismissNotice}
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
