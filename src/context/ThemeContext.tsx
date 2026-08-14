import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  colors: typeof darkColors;
}

// Dark theme colors - SAME AS CLIENT APP
const darkColors = {
  primary: '#9B7BD4',
  primaryDark: '#7B5BB4',
  secondary: '#E8A0B8',
  background: '#0A0A0F',
  backgroundCard: '#14141F',
  backgroundElevated: '#1A1A2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#6B6B7B',
  border: '#2A2A3E',
  success: '#4CD964',
  error: '#FF4757',
  warning: '#FFD93D',
  info: '#6C9BF7',
  gold: '#FFD700',
};

// Light theme colors - SAME AS CLIENT APP
const lightColors = {
  primary: '#9B7BD4',
  primaryDark: '#7B5BB4',
  secondary: '#E8A0B8',
  background: '#FFFFFF',
  backgroundCard: '#F8F8FC',
  backgroundElevated: '#F0F0F8',
  textPrimary: '#1A1A2E',
  textSecondary: '#5A5A6E',
  textMuted: '#8A8A9E',
  border: '#E0E0E8',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FFCC00',
  info: '#5B8DEF',
  gold: '#FFB800',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('psychic_theme_mode');
        if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
      setIsLoaded(true);
    };
    loadTheme();
  }, []);

  // Determine if dark mode based on theme setting
  const isDark = themeMode === 'auto' 
    ? systemColorScheme === 'dark' 
    : themeMode === 'dark';

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem('psychic_theme_mode', mode);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const colors = isDark ? darkColors : lightColors;

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { darkColors, lightColors };
