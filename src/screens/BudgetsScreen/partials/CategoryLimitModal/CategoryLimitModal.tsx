import {useEffect, useState} from 'react';
import {
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {Modal, Text, Title} from '@redshank/native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import InputField from '@screens/[categories]/CreateCategory/partials/InputField/InputField';
import SaveAction from '@screens/[categories]/CreateCategory/partials/SaveAction/SaveAction';
import {colors, gray, primary, white} from '@constants/colors/colors';
import {parseAmountToCents} from '@utils/currency';
import {centsToEditableAmountText} from '../../mappers';
import {useTranslation} from 'react-i18next';

export type CategoryLimitModalMode = 'add' | 'edit';

interface CategoryLimitModalProps {
  visible: boolean;
  mode: CategoryLimitModalMode;
  /** Only rendered (as a picker) in `mode === 'add'` — categories that
   * do NOT already have a limit set for this period, see
   * `useBudgetsScreen`'s `categoriesWithoutBudget`. */
  categories: ICategory[];
  /** `mode === 'edit'` only — the category being edited, shown locked
   * (no picker, matches this slice's "you can't reassign an existing
   * limit to a different category" scope decision — see this
   * component's doc comment). */
  initialCategory?: ICategory;
  /** `mode === 'edit'` only — the current limit, prefilled. */
  initialLimitAmount?: number;
  isSubmitting: boolean;
  onSubmit: (idCategory: number, limitAmount: number) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet for BOTH "set a limit for a new category" (`mode:
 * 'add'`, category picker + amount) and "edit an existing category's
 * limit" (`mode: 'edit'`, category locked, amount prefilled) — not part
 * of the approved `BudgetsScreen` prototype (that mock only shows the
 * resulting rows, not the interaction that creates them), reuses
 * `AccountPickerModal`'s bottom-sheet shape (see that component's doc
 * comment for the `BackHandler`/`closable={false}` reasoning, identical
 * here). Flagged for design review in this slice's HANDOFF.
 *
 * Editing never lets the category itself change — `setCategoryBudget`
 * is keyed on `(idCategory, period)` (see its doc comment: it UPDATEs
 * the existing row for that exact pair, or INSERTs a new one), so
 * "reassigning" an edit to a different category would silently create
 * a SECOND budget row instead of moving the first one. Simplest correct
 * scope for this slice: change the category by archiving/re-adding
 * instead, matching envelopes' `kind` — not editable, same reasoning.
 */
export const CategoryLimitModal = ({
  visible,
  mode,
  categories,
  initialCategory,
  initialLimitAmount,
  isSubmitting,
  onSubmit,
  onClose,
}: CategoryLimitModalProps) => {
  const {t} = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<ICategory | undefined>(
    initialCategory,
  );
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedCategory(mode === 'edit' ? initialCategory : undefined);
    setAmountText(
      mode === 'edit' && initialLimitAmount !== undefined
        ? centsToEditableAmountText(initialLimitAmount)
        : '',
    );
    setError('');
    // Only depends on the sheet actually opening / which row opened it
    // — `categories` changing while it's already open (a reload landing
    // mid-edit) should not blow away what the user already typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, initialCategory?.id, initialLimitAmount]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  const title =
    mode === 'edit'
      ? t('budgets.editLimitTitle', {name: initialCategory?.name ?? ''})
      : t('budgets.setLimit');

  const handleSubmit = () => {
    if (!selectedCategory) {
      setError(t('budgets.chooseCategory'));
      return;
    }
    const amount = parseAmountToCents(amountText);
    if (amount === null) {
      setError(t('budgets.invalidLimit'));
      return;
    }
    setError('');
    onSubmit(selectedCategory.id, amount);
  };

  // The trailing amount field + Save button — shared by both modes.
  // In `mode === 'add'` these are folded into the FlatList below as its
  // `ListFooterComponent` (see that FlatList's own comment for why:
  // rendering a SECOND, independently-scrolling list as a sibling of an
  // outer scroll container is exactly the "VirtualizedLists should
  // never be nested inside plain ScrollViews" trap this modal used to
  // hit when `Modal`'s own `scrollable` prop supplied that outer
  // scroll). In `mode === 'edit'` (no list at all) they are rendered
  // directly.
  const amountField = (
    <>
      <InputField
        inputText={amountText}
        onChangeInputText={setAmountText}
        placeholder={t('budgets.monthlyLimitPlaceholder')}
        accessibilityLabel={t('budgets.monthlyLimitAccessibilityLabel')}
        keyboardType="decimal-pad"
        error={error}
      />
      <View style={styles.actions}>
        <SaveAction onSave={handleSubmit} disabled={isSubmitting} />
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      position="bottom"
      maskClosable
      closable={false}
      contentStyle={styles.content}
      contentContainerStyle={styles.contentContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {mode === 'edit' ? (
          <>
            <Title level={4} style={styles.title}>
              {title}
            </Title>
            {initialCategory && (
              <View style={styles.lockedCategory}>
                <View style={styles.rowIcon}>
                  <VectorIcon
                    name={initialCategory.icon}
                    color={colors[white][0]}
                    size={16}
                  />
                </View>
                <Text>{initialCategory.name}</Text>
              </View>
            )}
            {amountField}
          </>
        ) : (
          // The ONLY scrollable element in "add" mode — title/empty-state/
          // amount field/Save all ride along as its header/footer instead
          // of living in a separate outer `ScrollView`, so there is never
          // a nested `VirtualizedList` here.
          <FlatList
            data={categories}
            keyExtractor={item => item.id.toString()}
            style={styles.list}
            ListHeaderComponent={
              <Title level={4} style={styles.title}>
                {title}
              </Title>
            }
            ListEmptyComponent={
              <Text color={colors[gray][0]} style={styles.empty}>
                {t('budgets.everyCategoryHasLimit')}
              </Text>
            }
            ListFooterComponent={<View style={styles.footer}>{amountField}</View>}
            renderItem={({item}) => {
              const isSelected = selectedCategory?.id === item.id;
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{selected: isSelected}}
                  onPress={() => setSelectedCategory(item)}
                  style={[styles.row, isSelected && styles.rowSelected]}>
                  <View style={styles.rowIcon}>
                    <VectorIcon name={item.icon} color={colors[white][0]} size={16} />
                  </View>
                  <Text>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  contentContainer: {
    width: '100%',
    paddingBottom: 10,
  },
  title: {
    marginBottom: 10,
  },
  list: {
    // Generous, not tight — this is now the ONE scrollable region for
    // the whole "add" sheet (title + rows + amount field + Save all
    // ride along as its header/footer, see the component body), so it
    // needs enough room to show the amount field without scrolling on
    // an ordinary phone with a handful of categories. `content`'s own
    // `maxHeight: '80%'` is still the real safety cap for a long
    // category list.
    width: '100%',
    maxHeight: 480,
  },
  footer: {
    marginTop: 10,
  },
  empty: {
    paddingVertical: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors[gray][0],
  },
  rowSelected: {
    backgroundColor: colors.inactive[0],
  },
  lockedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors[primary][0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
});

export default CategoryLimitModal;
