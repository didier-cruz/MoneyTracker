import {FC} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text} from '@components/atoms/text/Text';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import {accent, colors} from '@constants/colors/colors';

export interface InsightStripProps {
  /** One natural-language sentence — see `AnalysisScreen/mappers.ts`'s
   * `buildDebtsInsight`/`buildFundsInsight` for how each card's text is
   * built. Never rendered when there is nothing to say (an empty
   * envelope list) — that case is the card's own empty state instead,
   * see `AnalysisPieCard`. */
  text: string;
}

/** `rgba(199,255,112,0.24)` is `colors.accent[0]` (`#C7FF70`) at 24%
 * opacity over this screen's off-white surface — the soft "lectura"
 * wash the approved prototype actually draws, not the SOLID lime a
 * plain `backgroundColor: colors.accent[0]` renders. Same
 * literal-rgba-with-a-token-provenance-comment convention
 * `FormScreen/partials/AmountCard`'s own `DIVIDER_COLOR` already uses
 * for the identical token at a different opacity — this app has no
 * shared hex-to-rgba helper to derive it from instead. */
const STRIP_BACKGROUND = 'rgba(199,255,112,0.24)';

/**
 * The light-lime "info" strip under each pie card, per the approved
 * prototype — a plain-language reading of the chart above it, not a
 * repeat of the legend's numbers. On the Funds card this is where
 * "cuándo lo utilizo" (the third Analítica user story) actually gets
 * answered: the chart/legend show WHAT is saved, this strip is the one
 * place that says WHEN it was last touched (see `mappers.ts`'s
 * `buildFundsInsight`) — a static donut alone cannot show timing, no
 * matter how the sectors are colored.
 *
 * `colors.accent[3]` (not `colors.accent[2]`/text-on-white) for the
 * text color — see `colors.ts`'s own comment on `accent`: index `3` is
 * the one shade in that ramp built specifically for legible text over
 * `accent[0]`; over THIS strip's actual (much lighter, washed) 24%-
 * opacity background `accent[3]` reads with even MORE contrast than it
 * was built for, not less, so this deliberate prior fix is kept as-is
 * — only `container`'s `backgroundColor` below changes.
 */
export const InsightStrip: FC<InsightStripProps> = ({text}) => {
  return (
    <View style={styles.container} accessible accessibilityRole="text" accessibilityLabel={text}>
      <FontAwesomeIcon icon={faCircleInfo} color={colors[accent][3]} size={16} />
      <Text color={colors[accent][3]} size={12} style={styles.text}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: STRIP_BACKGROUND,
  },
  text: {
    flex: 1,
    marginLeft: 8,
  },
});

export default InsightStrip;
