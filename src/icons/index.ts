// in App.js
import {library} from '@fortawesome/fontawesome-svg-core';
import {fab} from '@fortawesome/free-brands-svg-icons';
import {faIcons} from '@fortawesome/free-solid-svg-icons/faIcons';
import {faEllipsis} from '@fortawesome/free-solid-svg-icons/faEllipsis';
import {faChevronLeft} from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import {faTrophy} from '@fortawesome/free-solid-svg-icons/faTrophy';

export default () => {
  library.add(fab, faIcons, faEllipsis, faChevronLeft, faTrophy);
};
