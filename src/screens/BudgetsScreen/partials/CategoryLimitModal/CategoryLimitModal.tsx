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
import {accent, colors, gray, primary, white} from '@constants/colors/colors';
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

  /**
   * "Add" is two steps: pick a category, THEN type the amount.
   *
   * It used to be one long list with the amount field and Save button
   * as its footer. With the ~20 seeded expense categories that footer
   * sat far below the fold: a tester picked a category, saw nothing
   * happen, and had to discover by scrolling that the input and the CTA
   * were at the very bottom. Now tapping a category swaps the list for
   * the same amount view that "edit" already uses (category shown
   * locked, input focused, Save right under it), with a "Change" link to
   * go back to the list. The step is derived from `selectedCategory`,
   * not stored separately, so the two can never disagree.
   *
   * Still no nested `VirtualizedList`: the list is the only scrollable
   * element and only renders while no category is picked.
   */
  const isPicking = mode === 'add' && !selectedCategory;
  const shownCategory = mode === 'edit' ? initialCategory : selectedCategory;

  const amountView = (
    <View style={styles.paddedContent}>
      <Title level={4} style={styles.title}>
        {title}
      </Title>
      {shownCategory && (
        <View style={styles.lockedCategory}>
          <View style={styles.rowIcon}>
            <VectorIcon
              name={shownCategory.icon}
              color={colors[white][0]}
              size={16}
            />
          </View>
          <Text style={styles.lockedCategoryName}>{shownCategory.name}</Text>
          {mode === 'add' && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('budgets.changeCategoryAccessibilityLabel')}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              onPress={() => {
                setSelectedCategory(undefined);
                setError('');
              }}>
              <Text color={colors[accent][2]} size="xs">
                {t('budgets.changeCategory')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <InputField
        inputText={amountText}
        onChangeInputText={setAmountText}
        placeholder={t('budgets.monthlyLimitPlaceholder')}
        accessibilityLabel={t('budgets.monthlyLimitAccessibilityLabel')}
        keyboardType="decimal-pad"
        autoFocus={mode === 'add'}
        error={error}
      />
      <View style={styles.actions}>
        <SaveAction onSave={handleSubmit} disabled={isSubmitting} />
      </View>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight="80%">
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isPicking ? (
          // `flexShrink: 1` (`styles.list`) is what lets it actually
          // shrink/scroll under `BottomSheet`'s own `maxHeight="80%"` —
          // see that prop's doc comment.
          <FlatList
            data={categories}
            keyExtractor={item => item.id.toString()}
            style={styles.list}
            ListHeaderComponent={
              <View style={[styles.title, styles.paddedContent]}>
                <Title level={4}>{title}</Title>
                {categories.length > 0 && (
                  <Text color={colors[gray][0]} size="xs">
                    {t('budgets.pickLimitCategory')}
                  </Text>
                )}
              </View>
            }
            ListEmptyComponent={
              <Text color={colors[gray][0]} style={[styles.empty, styles.paddedContent]}>
                {t('budgets.everyCategoryHasLimit')}
              </Text>
            }
            renderItem={({item}) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={item.name}
                onPress={() => {
                  setSelectedCategory(item);
                  setError('');
                }}
                style={styles.row}>
                <View style={styles.rowIcon}>
                  <VectorIcon name={item.icon} color={colors[white][0]} size={16} />
                </View>
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          amountView
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
    // Only the category picker now — the amount field and Save live in
    // the second step (see `isPicking` in the component body).
    // `BottomSheet`'s own `maxHeight="80%"` is the real cap for a long
    // category list. `flexShrink: 1` — see `keyboardAvoiding`'s comment
    // above.
    width: '100%',
    maxHeight: 480,
    flexShrink: 1,
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
  lockedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  lockedCategoryName: {
    flex: 1,
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
