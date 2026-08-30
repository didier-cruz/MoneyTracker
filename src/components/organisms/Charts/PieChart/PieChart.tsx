import React, {FC, useState} from 'react';
import {Text, View} from 'react-native';
import {PieChart as PieChartGifted} from 'react-native-gifted-charts';
import {RenderLegend} from './partials/RenderLend';
import {SelectPro} from '@components/molecules/Selects/SelectPro';

export const PieChart: FC<PieChartProps> = ({data, radius, items}) => {
  const [chartData, setChartData] = useState(data[0].finances);

  const [balanceGnrl, setBalanceGnrl] = useState<number>(100);
  const [balanceLbl, setBalanceLbl] = useState<string>('Ahorros');

  const onPressChartItem = ({value, color, text}: ChartItem, index: number) => {
    console.log({index, value, color, text});
    setBalanceGnrl(value);
    setBalanceLbl(
      index === 0 ? 'Ahorros' : index === 1 ? 'Gastos' : 'Ingresos',
    );
  };

  const onSelect = (option: any, _optionIndex: number) => {
    const chartItemSelected = data.find(
      (item: any) => item.value === option.value,
    );
    setChartData(chartItemSelected.finances);
    setBalanceLbl('Ahorros');
    setBalanceGnrl(chartItemSelected.finances[0].value);
  };

  return (
    <View
      style={{
        flexDirection: 'column',
        alignItems: 'center',
      }}>
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-evenly',
          marginVertical: 15,
        }}>
        <RenderLegend text="Ingresos" color="#177AD5" onPress={() => {}} />
        <RenderLegend text="Ahorros" color="#79D2DE" onPress={() => {}} />
        <RenderLegend text="Gastos" color="red" onPress={() => {}} />
      </View>
      <SelectPro
        options={items}
        defaultOption={items[0]}
        onSelect={onSelect}
        clearable={false}
        animation={100}
        theme="dark"
      />
      <PieChartGifted
        data={chartData}
        showText
        textColor="black"
        radius={radius}
        textSize={20}
        focusOnPress
        toggleFocusOnPress={false}
        sectionAutoFocus={true}
        showValuesAsLabels
        showTextBackground
        textBackgroundRadius={26}
        donut
        onPress={onPressChartItem}
        centerLabelComponent={() => {
          return (
            <View>
              <Text style={{color: 'black', fontSize: 36}}>${balanceGnrl}</Text>
              <Text style={{color: 'black', fontSize: 18, textAlign: 'center'}}>
                {balanceLbl}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
};
