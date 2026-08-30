import {NavigationControl} from '@components/atoms/NavigationControl';
import {accent, black, colors, gray, secondary, white} from '@constants/colors/colors';
import {Headings} from '@components/atoms/text/Headings/Headings';
import {StackNavParams} from '@navigation/StackNav/types';
import {StackScreenProps} from '@react-navigation/stack';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import {
  ScreenContainer,
  KeyboardContainer,
  ScrollContainer,
  Spacer,
} from '@components/atoms';
import {useFormScreen} from '@hooks/useFormScreen';
import Icon from 'react-native-vector-icons/FontAwesome';
import AccountSelector from './partials/AccountSelector/AccountSelector';
import {useTranslation} from 'react-i18next';

interface FormScreenProps extends StackScreenProps<StackNavParams, 'Form'> {}

export const FormScreen = ({navigation}: FormScreenProps) => {
  const {t} = useTranslation();
  const {
    inputText,
    onChangeInputText,
    visibleInputText,
    selectedCategory,
    selectCategory,
    categories,
    categoriesStatus,
    categoriesErrorMessage,
    reloadCategories,
    accounts,
    accountsStatus,
    accountsErrorMessage,
    selectedAccount,
    selectAccount,
    amountError,
    isSaving,
    saveTransaction,
  } = useFormScreen();

  return (
    <KeyboardContainer>
      <ScrollContainer
        style={
          {
            // backgroundColor: 'blue'
          }
        }>
        <ScreenContainer
          containerStyle={
            {
              // backgroundColor: 'red',
            }
          }>
          <NavigationControl
            firstActionPress={() => navigation.navigate('Dashboard')}
            secondActionPress={() => navigation.navigate('Form')}
          />

          {categoriesStatus === 'loading' && (
            <View style={stateStyles.centered}>
              <ActivityIndicator
                size="large"
                color={colors[accent][2]}
                accessibilityLabel={t('form.loadingCategories')}
              />
            </View>
          )}

          {categoriesStatus === 'error' && (
            <View style={stateStyles.centered}>
              <Headings
                headingSize="H5"
                color={colors[secondary][0]}
                containerStyle={stateStyles.message}>
                {categoriesErrorMessage}
              </Headings>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('form.retryLoadingCategories')}
                onPress={reloadCategories}
                style={stateStyles.retryButton}>
                <Headings headingSize="H5" color={colors[white][0]}>
                  {t('common.retry')}
                </Headings>
              </TouchableOpacity>
            </View>
          )}

          {categoriesStatus === 'success' && categories.length === 0 && (
            <View style={stateStyles.centered}>
              <Headings
                headingSize="H4"
                color={colors[black][0]}
                containerStyle={stateStyles.message}>
                {t('form.noCategoriesYet')}
              </Headings>
              <Headings
                headingSize="H6"
                color={colors[gray][0]}
                containerStyle={stateStyles.message}>
                {t('form.noCategoriesHint')}
              </Headings>
            </View>
          )}

          {categoriesStatus === 'success' && categories.length > 0 && (
            <>
              {visibleInputText ? (
                <>
                  <TextInput
                    value={inputText}
                    style={inputStyles.textInput}
                    onChangeText={onChangeInputText}
                    placeholder="$0.00"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    accessibilityLabel={t('form.transactionAmount')}
                  />
                  <Spacer space={10} />
                  <AccountSelector
                    accounts={accounts}
                    selectedAccount={selectedAccount}
                    onSelectAccount={selectAccount}
                    status={accountsStatus}
                    errorMessage={accountsErrorMessage}
                  />
                  {amountError ? (
                    <Headings
                      headingSize="H6"
                      color={colors[secondary][0]}
                      containerStyle={stateStyles.message}>
                      {amountError}
                    </Headings>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{disabled: isSaving}}
                    accessibilityLabel={t('form.saveTransactionAccessibilityLabel')}
                    disabled={isSaving}
                    onPress={saveTransaction}
                    style={[
                      inputStyles.saveButton,
                      isSaving && inputStyles.saveButtonDisabled,
                    ]}>
                    <Text style={inputStyles.saveButtonText}>
                      {isSaving ? t('common.saving') : t('common.save')}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <></>
              )}
              <Spacer space={15} />

              <View
                style={{
                  backgroundColor: 'white',
                  // width: '85%',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  marginHorizontal: 'auto',
                  borderRadius: 15,
                }}>
                {categories.map((category: ICategory) => {
                  const {id, icon, name} = category;
                  return (
                    <TouchableOpacity
                      key={id}
                      accessibilityRole="button"
                      accessibilityLabel={t('form.selectCategoryAccessibilityLabel', {name})}
                      accessibilityState={{
                        selected: selectedCategory?.id === id,
                      }}
                      style={{
                        // backgroundColor: 'red',
                        flex: 1,
                        minWidth: 100,
                        maxWidth: 100,
                        height: 100,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor:
                          selectedCategory?.id === id
                            ? colors[black][0]
                            : 'transparent',
                        borderRadius: 15,
                      }}
                      onPress={() => selectCategory(category)}>
                      <Icon
                        name={icon}
                        size={30}
                        color={
                          selectedCategory?.id === id
                            ? colors[white][0]
                            : colors[black][0]
                        }
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          color:
                            selectedCategory?.id === id
                              ? colors[white][0]
                              : colors[black][0],
                        }}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScreenContainer>
      </ScrollContainer>
    </KeyboardContainer>
  );
};

const inputStyles = StyleSheet.create({
  textInput: {
    height: 40,
    width: '60%',
    textAlign: 'center',
    backgroundColor: colors[white][0],
    borderColor: colors[black][0],
    borderRadius: 10,
    borderWidth: 1,
  },
  saveButton: {
    marginTop: 10,
    height: 44,
    minWidth: 120,
    borderRadius: 10,
    backgroundColor: colors[accent][2],
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors[white][0],
    fontWeight: '500',
  },
});

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
