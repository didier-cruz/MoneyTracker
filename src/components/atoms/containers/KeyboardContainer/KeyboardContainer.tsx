import React from 'react';
import {KeyboardAvoidingView, Platform} from 'react-native';
import styles from './styles';
import {KeyboardContainerTypes} from './types';

export const KeyboardContainer = ({
  children,
  containerStyle,
}: KeyboardContainerTypes) => {
  return (
    /*
     * En Android NO se usa `behavior`: el sistema ya reajusta la ventana
     * al abrir el teclado (`adjustResize`). Combinarlo con
     * `behavior="height"` hacia que el contenedor se redimensionara dos
     * veces, y ese re-layout tumbaba el foco del TextInput: solo entraba
     * un digito y el teclado se cerraba. El offset de 500 agravaba lo
     * mismo. En iOS si hace falta `padding`, porque alli el sistema no
     * reajusta nada.
     */
    <KeyboardAvoidingView
      style={[styles.keyboardAvoidingViewContainer, containerStyle]}
      keyboardVerticalOffset={0}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
};
