import {HomeNavigator} from '@navigation/[home]/HomeNavigator';
import {DrawerLabel} from './partials/DrawerLabel';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faHome} from '@fortawesome/free-solid-svg-icons/faHome';
import {faLayerGroup} from '@fortawesome/free-solid-svg-icons/faLayerGroup';
import {CategoriesAdminNavigator} from '@navigation/[categories]/CategoriesAdminNavigator';

export const drawerRouter: IDrawer[] = [
  {
    // El nombre de ruta es un IDENTIFICADOR y no se traduce: antes era
    // el texto traducido, así que cambiar de idioma habría renombrado la
    // ruta y roto cualquier navigate() hacia ella.
    name: 'Home',
    component: HomeNavigator,
    options: {
      drawerLabel: ({color}) => <DrawerLabel i18nKey="drawer.home" color={color} />,
      drawerIcon: ({color, focused: _focused, size}: any) => (
        <FontAwesomeIcon icon={faHome} color={color} size={size} />
      ),
    },
  },
  {
    // Administrar categorias: listar, crear, editar y borrar. NO muestra
    // movimientos — recorrer los movimientos de una categoria es lo que
    // hace la pestana Categorias de Movimientos. Aqui la pregunta es
    // "que categorias tengo y como las cambio".
    name: 'CategoriesAdmin',
    component: CategoriesAdminNavigator,
    options: {
      drawerLabel: ({color}) => (
        <DrawerLabel i18nKey="drawer.categories" color={color} />
      ),
      drawerIcon: ({color, focused: _focused, size}: any) => (
        <FontAwesomeIcon icon={faLayerGroup} color={color} size={size} />
      ),
    },
  },
];
