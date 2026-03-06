import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // ✅ DARK MODE LOCKED: Entire app is designed for dark glassmorphism only
  // No light mode support — this prevents UI breakage and provides best UX
  const [theme] = useState<Theme>('dark');

  useEffect(() => {
    // Force and lock dark mode on document root
    document.documentElement.classList.add('dark');
    // Clear any light mode preference from localStorage
    try {
      localStorage.setItem('theme', 'dark');
    } catch (error) {
      console.warn('Error saving theme to localStorage:', error);
    }
  }, []);

  // Disabled: theme toggle is locked to dark mode for best UX
  const setTheme = () => {};
  const toggleTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};