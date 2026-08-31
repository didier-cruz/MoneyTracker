import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {insertCategory} from '@db/queries';
import {useNoticeDialog} from '@hooks/useNoticeDialog';

const DEFAULT_CATEGORY_TYPE: ICategory['type'] = 'expense';

/**
 * Shared form state for creating a category.
 * Consumed by CategoriesScreen and CreateCategory.
 *
 * Same fix as `useAccountForm`/`useEnvelopeForm` — see `useAccountForm`'s
 * doc comment for why a save-success notice (an `Alert.alert` before) is
 * exposed as `notice`/`dismissNotice` state instead of rendered here;
 * `CreateCategory` owns the `<ConfirmDialog>`.
 */
export const useCategoryForm = () => {
  const {t} = useTranslation();
  const {notice, showNotice, dismissNotice} = useNoticeDialog();
  const [inputText, setInputText] = useState<string>('');

  const [selectedIcon, onChangeSelectedIcon] = useState<IIcon>();

  const [selectedType, setSelectedType] =
    useState<ICategory['type']>(DEFAULT_CATEGORY_TYPE);

  const [error, setError] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const onChangeInputText = (text: string) => {
    setInputText(text);
  };

  const onChangeSelectedType = (type: ICategory['type']) => {
    setSelectedType(type);
  };

  const handlePressItem = (id: number, icon: string) => {
    onChangeSelectedIcon({id, icon});
  };

  // Drives `SaveAction`'s `disabled` state: a name and an icon are both
  // required, and a save already in flight blocks re-submitting.
  const canSave = inputText.trim() !== '' && !!selectedIcon && !isSaving;

  const createCategory = async () => {
    if (inputText.trim() === '') {
      setError(t('categories.form.nameRequired'));
      return;
    }
    if (!selectedIcon) {
      setError(t('categories.form.iconRequired'));
      return;
    }
    setIsSaving(true);
    try {
      const db = await getDbConnection();
      await insertCategory(db, inputText, selectedIcon.icon, selectedType);
      setError('');
      setInputText('');
      onChangeSelectedIcon(undefined);
      showNotice('info', t('common.success'), t('categories.form.created'));
    } catch (e: any) {
      setError(t('categories.form.saveError', {message: e.message}));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    inputText,
    onChangeInputText,
    selectedIcon,
    onChangeSelectedIcon,
    selectedType,
    onChangeSelectedType,
    error,
    setError,
    isSaving,
    canSave,
    handlePressItem,
    createCategory,
    notice,
    dismissNotice,
  };
};
