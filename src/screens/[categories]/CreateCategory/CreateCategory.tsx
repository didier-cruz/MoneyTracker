import {StackScreenProps} from '@react-navigation/stack';
import {ScreenContainer, KeyboardContainer, Spacer} from '@components/atoms';
import {ConfirmDialog} from '@components/organisms/feedback';
import {useCategoryForm} from '@hooks/useCategoryForm';
import {InputField, SymbolList, SaveAction, RadioField} from './partials';
import {ScrollView} from 'react-native-gesture-handler';
import Header from '../components/Header/Header';
import {CategoriesNavParams} from '@navigation/[categories]/CategoriesNavigator/types';
import {useTranslation} from 'react-i18next';

interface CreateCategoryProps
  extends StackScreenProps<CategoriesNavParams, 'CreateCategory'> {}
//TODO: Add navigation to more icons
//TODO: Change the more icons location at the end of the icon list
//TODO: posibility to implement formik if needed
export const CreateCategory = ({
  navigation: _navigation,
  route: _route,
}: CreateCategoryProps) => {
  const {t} = useTranslation();
  const {
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
  } = useCategoryForm();

  return (
    <>
      <KeyboardContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenContainer>
            <Header
              title={t('categories.createCategoryTitle')}
              message={t('categories.createCategoryMessage')}
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

      {/* Unlike `CreateAccount`/`CreateEnvelope`, this screen never
          navigates away on save (it stays open to add another
          category — see this hook's own doc comment), so dismissing
          this notice needs nothing beyond closing it. */}
      <ConfirmDialog
        visible={notice.visible}
        tone={notice.tone}
        title={notice.title}
        message={notice.message}
        onRequestClose={dismissNotice}
        primaryLabel={t('common.ok')}
        onPrimaryPress={dismissNotice}
      />
    </>
  );
};
