import React from 'react';
import {StyleSheet, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {colors, inactive, white} from '@constants/colors/colors';

/**
 * The divider between the "Desde" and "Hacia" cards from the approved
 * prototype: two hairlines around a 42px lime circle with a downward
 * arrow — purely decorative, no interaction.
 */
const TransferDivider = () => {
  return (
    <View style={styles.container}>
      <View style={styles.hairline} />
      <View style={styles.circle}>
        <VectorIcon name="arrow-down" color={colors[white][0]} size={18} />
      </View>
      <View style={styles.hairline} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: colors[inactive][0],
  },
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginHorizontal: 10,
    backgroundColor: colors.accent[1],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TransferDivider;
