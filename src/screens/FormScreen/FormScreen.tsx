import {accent, colors, gray, secondary, white} from '@constants/colors/colors';
import {Headings} from '@components/atoms/text/Headings/Headings';
import {StackNavParams} from '@navigation/StackNav/types';
import {StackScreenProps} from '@react-navigation/stack';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ScreenContainer,
  KeyboardContainer,
  ScrollContainer,
  Spacer,
} from '@components/atoms';
import Icon from 'react-native-vector-icons/FontAwesome';
import {useFormScreen} from '@hooks/useFormScreen';
import {useTranslation} from 'react-i18next';
import AmountCard from './partials/AmountCard';
import CategoryGrid from './partials/CategoryGrid';
import TypeSegment from './partials/TypeSegment';

interface FormScreenProps extends StackScreenProps<StackNavParams, 'Form'> {}

// Same one-off ink hex as `TypeSegment`/`CategoryGrid` — the
// prototype's default text color for the screen's own title, not in
// `@constants/colors`.
const INK = '#373737';

/**
 * "Nuevo movimiento" — registers one expense or income transaction.
 * Reached from the bottom tab bar's center "+" button (`Outcomes` tab,
 * `StackNav`, `Form` as its `initialRouteName` — see
 * `HomeBottomTabs/router.tsx`), NOT pushed on top of another screen,
 * so there is no guaranteed back destination; the header's chevron
 * only acts when `navigation.canGoBack()` (see `handleBack`).
 *
 * Previously wired to real data (`useFormScreen`) but never redrawn to
 * the approved prototype — this pass is the visual rebuild: segment ->
 * indigo amount card (with the account selector embedded in it, per
 * the prototype) -> category grid (now filtered by the active
 * segment, see `useFormScreen`'s `filteredCategories`) -> save button.
 * `NavigationControl` (the old white/black Inicio/Registros switcher)
 * is gone from this screen — it isn't in the prototype and
 * `DashboardScreen` still uses it independently (out of scope here).
 */
export const FormScreen = ({navigation}: FormScreenProps) => {
  const {t} = useTranslation();
  const {
    inputText,
    onChangeInputText,
    selectedType,
    selectType,
    selectedCategory,
    selectCategory,
    categories,
    filteredCategories,
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

  /**
   * Tras guardar, lleva al usuario a Balance en vez de mostrar un dialogo:
   * ver el movimiento en la lista es una confirmacion mas util que un aviso
   * que hay que cerrar. `getParent()` sube del stack de este tab al
   * navegador de pestanas.
   */
  const handleSave = async () => {
    const saved = await saveTransaction();
    if (saved) {
      navigation.getParent()?.navigate('Resumen' as never);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const categoryCountLabel =
    selectedType === 'expense'
      ? t('form.categoryCountExpense', {count: filteredCategories.length})
      : t('form.categoryCountIncome', {count: filteredCategories.length});

  return (
    <KeyboardContainer>
      <ScrollContainer>
        <ScreenContainer>
          <View style={styles.headerRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('form.back')}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
              onPress={handleBack}
              style={styles.backButton}>
              <Icon name="chevron-left" size={24} color={colors[gray][0]} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('form.title')}</Text>
          </View>

          <Spacer space={18} />

          <TypeSegment value={selectedType} onChange={selectType} />

          <Spacer space={18} />

          <AmountCard
            amountText={inputText}
            onChangeAmountText={onChangeInputText}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelectAccount={selectAccount}
            accountsStatus={accountsStatus}
            accountsErrorMessage={accountsErrorMessage}
          />

          {amountError ? (
            <>
              <Spacer space={8} />
              <Headings
                headingSize="H6"
                color={colors[secondary][0]}
                containerStyle={stateStyles.message}>
                {amountError}
              </Headings>
            </>
          ) : null}

          <Spacer space={18} />

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
                color={INK}
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
            <CategoryGrid
              title={t('form.categoryHeading')}
              countLabel={categoryCountLabel}
              categories={filteredCategories}
              selectedCategory={selectedCategory}
              onSelectCategory={selectCategory}
            onPressManageCategories={() => navigation.navigate('Categories')}
            />
          )}

          <Spacer space={20} />

          <View style={styles.saveRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{disabled: isSaving}}
              accessibilityLabel={t('form.saveTransactionAccessibilityLabel')}
              disabled={isSaving}
              onPress={handleSave}
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}>
              <Text style={styles.saveButtonText}>
                {isSaving ? t('common.saving') : t('common.save')}
              </Text>
            </Pressable>
          </View>

          <Spacer space={20} />
        </ScreenContainer>
      </ScrollContainer>
    </KeyboardContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    marginTop: 10,
  },
  backButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: INK,
  },
  saveRow: {
    width: '100%',
    alignItems: 'center',
  },
  saveButton: {
    width: '70%',
    height: 50,
    borderRadius: 15,
    backgroundColor: colors[accent][0],
    justifyContent: 'center',
    alignItems: 'center',
    // The prototype's own save button is `#5CA41B` bg / `#C7FF70`
    // text (2.65:1 contrast) — already fixed app-wide to
    // `accent[0]`/`accent[3]` before this pass (see `colors.ts`'s own
    // comment); NOT reverting that fix here.
    shadowColor: colors[accent][2],
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors[accent][3],
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
