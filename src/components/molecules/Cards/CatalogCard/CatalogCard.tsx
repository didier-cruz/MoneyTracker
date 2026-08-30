import {Card, Text, Title, useTheme} from '@redshank/native';
import {FC} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import VectorIcon from 'react-native-vector-icons/FontAwesome';
import {formatCentsToCurrency} from '@utils/currency';
import {colors as tokens} from '@constants/colors/colors';
import {useTranslation} from 'react-i18next';

const CatalogCard: FC<CatalogCard> = ({
  id,
  icon,
  iconColor,
  field,
  balance,
  onPress,
  onPressManage,
  iconBackground,
  selectedId,
  variant = 'square',
}) => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const isActive = selectedId === id;
  const isNegative = balance < 0;
  const isWide = variant === 'wide';
  const isAdd = variant === 'add';
  const showManageButton = !isAdd && !!onPressManage;

  const accessibilityLabel = isAdd
    ? field
    : t('accounts.catalogCardAccessibilityLabel', {
        name: field,
        balance: formatCentsToCurrency(balance),
      });

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{selected: !isAdd && isActive}}
      // The whole card is one merged accessibility element (`accessible`
      // above) — a screen-reader user cannot separately focus the small
      // "manage" button nested inside it (see below), so its action is
      // exposed here instead, reachable from VoiceOver's rotor /
      // TalkBack's local-context menu without needing a second stop.
      accessibilityActions={
        showManageButton ? [{name: 'manage', label: t('accounts.manageAccountAction')}] : undefined
      }
      onAccessibilityAction={
        showManageButton
          ? event => {
              if (event.nativeEvent.actionName === 'manage') {
                onPressManage();
              }
            }
          : undefined
      }>
      <Card
        style={[
          styles.card,
          isWide && styles.cardWide,
          isActive && {borderColor: colors.info, borderWidth: 1.5},
        ]}
        isPressable
        onPress={onPress}>
        <Card.Body style={styles.cardBody}>
          <View
            style={[
              styles.cardBodyContnr,
              isWide && styles.cardBodyContnrWide,
            ]}>
            <View
              style={{...styles.iconContainer, backgroundColor: iconBackground}}>
              <VectorIcon name={icon} color={iconColor} size={25} />
            </View>
            {!isAdd && (
              <View style={isWide ? styles.wideText : undefined}>
                <Text color="#373737" size={12}>
                  {field}
                </Text>
                <Title
                  level={2}
                  color={isNegative ? tokens.error[0] : undefined}>
                  {formatCentsToCurrency(balance)}
                </Title>
              </View>
            )}
            {isAdd && (
              <Text color="#373737" size={12} style={styles.addLabel}>
                {field}
              </Text>
            )}
          </View>
          {showManageButton && (
            // Sighted-user affordance for the same action exposed above
            // as a screen-reader `accessibilityAction` — visually reuses
            // this codebase's existing "more options" idiom (ellipsis in
            // a rounded `accent` chip; see `CategoriesList`'s
            // `AddCategory`/`SymbolList`'s header action). Not part of an
            // approved prototype for this screen — flagged for review.
            <TouchableOpacity
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={onPressManage}
              style={styles.manageButton}>
              <VectorIcon name="ellipsis-h" color={tokens.accent[0]} size={14} />
            </TouchableOpacity>
          )}
        </Card.Body>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    elevation: 10,
    marginVertical: 20,
    marginLeft: 20,
  },
  cardWide: {
    marginRight: 20,
  },
  cardBody: {position: 'relative'},
  cardBodyContnr: {
    width: 150,
    height: 150,
    justifyContent: 'space-around',
    paddingLeft: 20,
    paddingTop: 20,
  },
  cardBodyContnrWide: {
    width: 310,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wideText: {
    marginLeft: 20,
  },
  addLabel: {
    marginTop: 10,
  },
  iconContainer: {
    height: 40,
    width: 40,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
  manageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.accent[1],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CatalogCard;
