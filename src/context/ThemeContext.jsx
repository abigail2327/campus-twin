/**
 * ThemeContext.jsx
 * Global dark/light mode — accessible by any page via useTheme()
 */
import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext({ dark: true, toggle: () => {} });

export function ThemeProvider({ children }) {
    const [dark, setDark] = useState(true);
    return (
        <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}