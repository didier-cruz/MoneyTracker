import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getDbConnection} from '@db/db';
import {getCategoryById, insertCategory, updateCategory} from '@db/queries';
import {toIcon} from '@data/iconCatalog';
import {useNoticeDialog} from '@hooks/useNoticeDialog';

const DEFAULT_CATEGORY_TYPE: ICategory['type'] = 'expense';

export type CategoryFormMode = 'create' | 'edit';
export type CategoryFormLoadStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Estado del formulario de categoria, para crear Y para editar.
 *
 * Con `categoryId` entra en modo edicion: precarga nombre, icono y tipo,
 * y al guardar actualiza en vez de insertar. Misma forma que
 * `useAccountForm`/`useEnvelopeForm`, incluido por que el aviso de
 * guardado se expone como estado `notice` en vez de pintarse aqui — ver
 * el comentario de `useAccountForm`.
 */
export const useCategoryForm = (categoryId?: number) => {
  const mode: CategoryFormMode = categoryId === undefined ? 'create' : 'edit';
  const {t} = useTranslation();
  const {notice, showNotice, dismissNotice} = useNoticeDialog();
  const [inputText, setInputText] = useState<string>('');

  const [selectedIcon, onChangeSelectedIcon] = useState<IIcon>();

  const [selectedType, setSelectedType] =
    useState<ICategory['type']>(DEFAULT_CATEGORY_TYPE);

  const [error, setError] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [loadStatus, setLoadStatus] = useState<CategoryFormLoadStatus>(
    categoryId === undefined ? 'success' : 'loading',
  );
  const [loadErrorMessage, setLoadErrorMessage] = useState<string>('');

  const loadCategory = useCallback(async () => {
    if (categoryId === undefined) {
      return;
    }
    setLoadStatus('loading');
    setLoadErrorMessage('');
    try {
      const db = await getDbConnection();
      const category = await getCategoryById(db, categoryId);
      if (!category) {
        setLoadErrorMessage(t('categories.form.notFound'));
        setLoadStatus('error');
        return;
      }
      setInputText(category.name);
      // Resuelto contra el catalogo completo, no contra los 16 rapidos:
      // asi un icono elegido desde el buscador aparece marcado al editar.
      onChangeSelectedIcon(toIcon(category.icon));
      setSelectedType(category.type);
      setLoadStatus('success');
    } catch (e: any) {
      setLoadErrorMessage(
        t('categories.form.loadError', {message: e?.message ?? t('common.unknownError')}),
      );
      setLoadStatus('error');
    }
  }, [categoryId, t]);

  useEffect(() => {
    loadCategory();
  }, [loadCategory]);

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

  /**
   * Crea o actualiza, segun el modo. Devuelve `true` si se guardo — la
   * pantalla decide si navegar.
   */
  const createCategory = async (): Promise<boolean> => {
    if (inputText.trim() === '') {
      setError(t('categories.form.nameRequired'));
      return false;
    }
    if (!selectedIcon) {
      setError(t('categories.form.iconRequired'));
      return false;
    }
    setIsSaving(true);
    try {
      const db = await getDbConnection();
      if (mode === 'edit' && categoryId !== undefined) {
        await updateCategory(db, categoryId, {
          name: inputText.trim(),
          icon: selectedIcon.icon,
          type: selectedType,
        });
        setError('');
        showNotice('info', t('common.success'), t('categories.form.updated'));
        return true;
      }
      await insertCategory(db, inputText, selectedIcon.icon, selectedType);
      setError('');
      setInputText('');
      onChangeSelectedIcon(undefined);
      showNotice('info', t('common.success'), t('categories.form.created'));
      return true;
    } catch (e: any) {
      // `updateCategory` rechaza cambiar el tipo de una categoria con
      // movimientos; ese caso merece explicacion, no un mensaje de error
      // generico con el texto interno.
      setError(
        e?.message === 'Cannot change the type of a category with movements'
          ? t('categories.form.typeLockedByMovements')
          : t('categories.form.saveError', {message: e.message}),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    mode,
    loadStatus,
    loadErrorMessage,
    reloadCategory: loadCategory,
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
