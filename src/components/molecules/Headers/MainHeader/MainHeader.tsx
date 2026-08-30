import {StyleSheet, Text, View} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faBarsStaggered} from '@fortawesome/free-solid-svg-icons/faBarsStaggered';
import {TouchableOpacity} from 'react-native-gesture-handler';
import {ParamListBase, useNavigation} from '@react-navigation/native';
import {DrawerNavigationProp} from '@react-navigation/drawer';
type MainHeaderProps = {
  title?: string;
  /**
   * Second header line, rendered as-is (never split further) — added
   * for `BudgetsScreen`'s "Budgets" / current-month two-line header.
   * Without this, the only way to get a second line was splitting
   * `title` on its first space and keeping just the SECOND word
   * (`title.split(' ')`'s destructure below silently drops everything
   * after that), which mangles any subtitle with more than one word
   * (e.g. `"August 2026"` -> `"August"`, losing the year). Optional and
   * additive: every existing caller that only ever passed `title`
   * (`AccountsScreen`/`ResumenScreen`/`AnalysisScreen`) keeps the exact
   * same split-on-first-space behavior it already had.
   */
  subtitle?: string;
};

const MainHeader = ({title = '', subtitle}: MainHeaderProps) => {
  const [title1, splitTitle2] = title.split(' ');
  const title2 = subtitle ?? splitTitle2;

  const navigation = useNavigation<DrawerNavigationProp<ParamListBase>>();

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 30,
        width: '100%',
      }}>
      <TouchableOpacity onPress={() => navigation.openDrawer()}>
        <FontAwesomeIcon
          icon={faBarsStaggered}
          color={'green'}
          size={30}
          style={{marginRight: 30, marginTop: 10}}
        />
      </TouchableOpacity>
      {title && (
        <View>
          <Text style={styles.title1}>
            {title1}
            {title2 && (
              <Text style={styles.title2}>
                {'\n'}
                {title2}
              </Text>
            )}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  title1: {
    color: '#373737',
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  title2: {
    color: '#373737',
    fontSize: 24,
    fontWeight: '400',
    textAlign: 'left',
  },
});

export default MainHeader;
