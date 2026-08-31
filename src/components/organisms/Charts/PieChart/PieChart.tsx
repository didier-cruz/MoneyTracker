import React, {FC, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {colors} from '@constants/colors/colors';
import {formatCentsToCurrency} from '@utils/currency';
import {Text, View} from 'react-native';
import {PieChart as PieChartGifted} from 'react-native-gifted-charts';
import {RenderLegend} from './partials/RenderLend';
import {SelectPro} from '@components/molecules/Selects/SelectPro';

export const PieChart: FC<PieChartProps> = ({data, radius, items}) => {
  const {t} = useTranslation();

  const [chartData, setChartData] = useState(data[0].finances);
  const [balanceGnrl, setBalanceGnrl] = useState<number>(data[0].finances[0]?.value ?? 0);
  const [balanceLbl, setBalanceLbl] = useState<string>(t('resumen.savings'));

  // Los datos llegan de la base y cambian al recargar la pantalla; sin
  // esto el grafico se quedaria mostrando la primera lectura.
  useEffect(() => {
    setChartData(data[0].finances);
    setBalanceGnrl(data[0].finances[0]?.value ?? 0);
    setBalanceLbl(t('resumen.savings'));
  }, [data, t]);

  const onPressChartItem = ({value}: ChartItem, index: number) => {
    setBalanceGnrl(value);
    setBalanceLbl(
      index === 0
        ? t('resumen.savings')
        : index === 1
        ? t('resumen.expense')
        : t('resumen.income'),
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
        {/*
          Colores alineados con CashFlowChart: las dos graficas viven en
          la misma pantalla y muestran las mismas tres series, asi que
          pintarlas distinto (antes azul/cian/rojo) hacia que el mismo
          concepto tuviera dos codigos de color a la vez.
        */}
        <RenderLegend
          text={t('resumen.income')}
          color={colors.accent[1]}
          onPress={() => {}}
        />
        <RenderLegend
          text={t('resumen.savings')}
          color={colors.warning[0]}
          onPress={() => {}}
        />
        <RenderLegend
          text={t('resumen.expense')}
          color={colors.error[0]}
          onPress={() => {}}
        />
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
        radius={radius}
        focusOnPress
        toggleFocusOnPress={false}
        sectionAutoFocus={true}
        donut
        onPress={onPressChartItem}
        centerLabelComponent={() => {
          return (
            <View>
              <Text style={{color: colors.text[0], fontSize: 26}}>
                {formatCentsToCurrency(balanceGnrl)}
              </Text>
              <Text style={{color: colors.text[1], fontSize: 16, textAlign: 'center'}}>
                {balanceLbl}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
};
