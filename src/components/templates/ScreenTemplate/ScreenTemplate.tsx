import {FC, PropsWithChildren, ReactElement} from 'react';
import {RefreshControlProps, ViewStyle} from 'react-native';
import {ScreenContainer} from '@components/atoms/containers/ScreenContainer';
import {ScrollContainer} from '@components/atoms/containers/ScrollContainer';

import {MainHeader} from '@components/molecules/Headers/MainHeader';

interface ScreenTemplateProps extends PropsWithChildren {
  headerTitle?: string;
  /** Passed straight through to `MainHeader`'s own `subtitle` — see
   * that component's doc comment. Optional/additive: omitted by every
   * existing caller, which keeps their current single-title header. */
  headerSubtitle?: string;
  screenContainerStyle?: ViewStyle;
  /** Passed straight through to `ScrollContainer`'s own
   * `refreshControl` — see that component's doc comment. Optional/
   * additive, same as `headerSubtitle` above. */
  refreshControl?: ReactElement<RefreshControlProps>;
}

const ScreenTemplate: FC<ScreenTemplateProps> = ({
  headerTitle,
  headerSubtitle,
  screenContainerStyle = {},
  refreshControl,
  children,
}) => {
  return (
    <ScrollContainer style={{flex: 1}} refreshControl={refreshControl}>
      <ScreenContainer containerStyle={screenContainerStyle}>
        <MainHeader title={headerTitle} subtitle={headerSubtitle} />
        {children}
      </ScreenContainer>
    </ScrollContainer>
  );
};

export default ScreenTemplate;
