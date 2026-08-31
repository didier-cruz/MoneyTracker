import {useEffect, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {BottomSheet} from '@components/organisms/feedback/BottomSheet';
import {Text} from '@components/atoms/text/Text';
import {Title} from '@components/atoms/text/Title';
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
 * resulting rows, not the interaction that creates them), built on the
 * shared `BottomSheet`. Flagged for design review in this slice's
 * HANDOFF.
 *
 * Was `@redshank/native`'s `Modal`, reusing `AccountPickerModal`'s old
 * shape — see that component's doc comment (and the `@redshank/native`
 * removal slice's HANDOFF) for why its `BackHandler` listener is gone
 * here too, not ported: `BottomSheet` renders RN's OWN `Modal` with
 * `onRequestClose` already wired to `onClose`, which RN wires to
 * Android's hardware back button natively.
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
    <BottomSheet visible={visible} onClose={onClose} maxHeight="80%">
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {mode === 'edit' ? (
          <View style={styles.paddedContent}>
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
          </View>
        ) : (
          // The ONLY scrollable element in "add" mode — title/empty-state/
          // amount field/Save all ride along as its header/footer instead
          // of living in a separate outer `ScrollView`, so there is never
          // a nested `VirtualizedList` here. `flexShrink: 1` (`styles.list`)
          // is what lets it actually shrink/scroll under `BottomSheet`'s
          // own `maxHeight="80%"` — see that prop's doc comment.
          <FlatList
            data={categories}
            keyExtractor={item => item.id.toString()}
            style={styles.list}
            ListHeaderComponent={
              <Title level={4} style={[styles.title, styles.paddedContent]}>
                {title}
              </Title>
            }
            ListEmptyComponent={
              <Text color={colors[gray][0]} style={[styles.empty, styles.paddedContent]}>
                {t('budgets.everyCategoryHasLimit')}
              </Text>
            }
            ListFooterComponent={
              <View style={[styles.footer, styles.paddedContent]}>{amountField}</View>
            }
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
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  // `flexShrink: 1` propagates the panel's `maxHeight` cap down through
  // this `KeyboardAvoidingView` to the `FlatList` inside it — without
  // it here too, the chain from `BottomSheet`'s own `body` wrapper down
  // to `styles.list` would break at this link. A no-op in `mode ===
  // 'edit'` (no list, content is always short).
  keyboardAvoiding: {
    flexShrink: 1,
  },
  // `BottomSheet`'s panel carries no horizontal padding of its own
  // (`ActionSheet` pads each row individually) — this sheet's rows
  // (`styles.row`) already do the same, so only the non-list content
  // (the title/locked-category/amount-field block) needs its own
  // explicit inset.
  paddedContent: {
    paddingHorizontal: 20,
  },
  title: {
    marginBottom: 10,
  },
  list: {
    // Generous, not tight — this is now the ONE scrollable region for
    // the whole "add" sheet (title + rows + amount field + Save all
    // ride along as its header/footer, see the component body), so it
    // needs enough room to show the amount field without scrolling on
    // an ordinary phone with a handful of categories. `BottomSheet`'s
    // own `maxHeight="80%"` is still the real safety cap for a long
    // category list. `flexShrink: 1` — see `keyboardAvoiding`'s
    // comment above.
    width: '100%',
    maxHeight: 480,
    flexShrink: 1,
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
    paddingHorizontal: 20,
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
