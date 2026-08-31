import {HomeNavigator} from '@navigation/[home]/HomeNavigator';
import {DrawerLabel} from './partials/DrawerLabel';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faHome} from '@fortawesome/free-solid-svg-icons/faHome';

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
  // {
  //   name: selectedLanguage.drawer[2].label,
  //   component: CreateCategory,
  //   options: {
  //     drawerLabel: selectedLanguage.drawer[2].label,
  //     drawerIcon: ({color, focused, size}) => (
  //       <FontAwesomeIcon icon={faLayerGroup} color={color} size={size} />
  //     ),
  //   },
  // },
];
