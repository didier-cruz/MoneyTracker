import { createContext, useEffect, useReducer } from "react";
import { ThemeState, darkTheme, lightTheme, themeReducer } from "./themeReducer";
import { useColorScheme } from "react-native";

interface ThemeContextProps {
    theme: ThemeState;
    setDarkTheme: () => void;
    setLightTheme: () => void;
}

export const ThemeContext = createContext({} as ThemeContextProps);

export const ThemeProvider = ({ children }: any) => {

    const colorScheme = useColorScheme();

    const [theme, dispatch] = useReducer(themeReducer, (colorScheme === 'dark') ? darkTheme : lightTheme) //TODO: Leer el tema global ...

    useEffect(() => {
      colorScheme === 'light'
        ? setLightTheme()
        : setDarkTheme();
    }, [colorScheme])
    

    const setDarkTheme = () => {
        dispatch({type: 'set_dark_theme'})
        console.log('setDarkTheme')
    }
    const setLightTheme = () => {
        dispatch({type: 'set_light_theme'})
        console.log('setLightTheme')
    }
    return (
        <ThemeContext.Provider
            value={{
                theme,
                setDarkTheme,
                setLightTheme
            }}>
            {children}
        </ThemeContext.Provider>
    )
}