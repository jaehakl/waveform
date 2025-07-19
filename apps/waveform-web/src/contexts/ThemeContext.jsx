import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// 색상 정의
const colors = {
  // Theme Colors
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  secondary: '#00bcd4',
  
  // Neutral Colors
  white: '#ffffff',
  black: '#000000',
  gray50: '#f8f9fa',
  gray100: '#f1f3f4',
  gray200: '#e8eaed',
  gray300: '#dadce0',
  gray400: '#bdc1c6',
  gray500: '#9aa0a6',
  gray600: '#80868b',
  gray700: '#5f6368',
  gray800: '#3c4043',
  gray900: '#202124',
  
  // Semantic Colors
  success: '#34a853',
  warning: '#fbbc04',
  error: '#ea4335',
  info: '#4285f4',
  
  // Bright Mode Colors
  bright: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f8f9fa',
    bgTertiary: '#e8eaed',
    borderLight: '#dadce0',
    borderMedium: '#bdc1c6',
    borderDark: '#9aa0a6',
    textPrimary: '#202124',
    textSecondary: '#5f6368',
    textTertiary: '#80868b',
    textDisabled: '#bdc1c6',
    textInverse: '#000000'
  },
  
  // Dark Mode Colors
  dark: {
    bgPrimary: '#1a1a1a',
    bgSecondary: '#2d2d2d',
    bgTertiary: '#404040',
    borderLight: '#404040',
    borderMedium: '#555555',
    borderDark: '#666666',
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    textTertiary: '#999999',
    textDisabled: '#666666',
    textInverse: '#ffffff'
  }
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(() => {
    // 로컬 스토리지에서 테마 설정을 가져오거나 기본값 사용
    const savedTheme = localStorage.getItem('theme-mode');
    return savedTheme || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = themeMode === 'dark' ? 'bright' : 'dark';
    setThemeMode(newTheme);
    localStorage.setItem('theme-mode', newTheme);
  };

  // 현재 테마의 색상 가져오기
  const getCurrentThemeColors = () => {
    return themeMode === 'bright' ? colors.bright : colors.dark;
  };

  // rsuite 테마 이름 가져오기
  const getRsuiteTheme = () => {
    return themeMode === 'dark' ? 'dark' : 'light';
  };

  useEffect(() => {
    // CSS 변수를 동적으로 업데이트
    const root = document.documentElement;
    const currentColors = getCurrentThemeColors();
    
    // 기본 색상들
    root.style.setProperty('--primary-color', colors.primary);
    root.style.setProperty('--primary-hover', colors.primaryHover);
    root.style.setProperty('--secondary-color', colors.secondary);
    root.style.setProperty('--success-color', colors.success);
    root.style.setProperty('--warning-color', colors.warning);
    root.style.setProperty('--error-color', colors.error);
    root.style.setProperty('--info-color', colors.info);
    
    // 투명도가 적용된 색상들
    root.style.setProperty('--primary-color-10', 'rgba(99, 102, 241, 0.1)');
    root.style.setProperty('--primary-color-20', 'rgba(99, 102, 241, 0.2)');
    root.style.setProperty('--primary-color-80', 'rgba(99, 102, 241, 0.8)');
    root.style.setProperty('--error-color-80', 'rgba(234, 67, 53, 0.8)');
    
    // 테마별 색상들
    root.style.setProperty('--bg-primary', currentColors.bgPrimary);
    root.style.setProperty('--bg-secondary', currentColors.bgSecondary);
    root.style.setProperty('--bg-tertiary', currentColors.bgTertiary);
    root.style.setProperty('--border-light', currentColors.borderLight);
    root.style.setProperty('--border-medium', currentColors.borderMedium);
    root.style.setProperty('--border-dark', currentColors.borderDark);
    root.style.setProperty('--text-primary', currentColors.textPrimary);
    root.style.setProperty('--text-secondary', currentColors.textSecondary);
    root.style.setProperty('--text-tertiary', currentColors.textTertiary);
    root.style.setProperty('--text-disabled', currentColors.textDisabled);
    root.style.setProperty('--text-inverse', currentColors.textInverse);
    
    // rsuite CSS 변수들 (rsuite 컴포넌트용)
    if (themeMode === 'bright') {
      // Bright mode rsuite 변수들
      root.style.setProperty('--rs-bg-primary', '#ffffff');
      root.style.setProperty('--rs-bg-secondary', '#f8f9fa');
      root.style.setProperty('--rs-bg-tertiary', '#e8eaed');
      root.style.setProperty('--rs-border-primary', '#dadce0');
      root.style.setProperty('--rs-border-secondary', '#bdc1c6');
      root.style.setProperty('--rs-text-primary', '#202124');
      root.style.setProperty('--rs-text-secondary', '#5f6368');
      root.style.setProperty('--rs-text-tertiary', '#80868b');
      root.style.setProperty('--rs-text-disabled', '#bdc1c6');
      root.style.setProperty('--rs-input-bg', '#ffffff');
      root.style.setProperty('--rs-input-border', '#dadce0');
      root.style.setProperty('--rs-input-text', '#202124');
      root.style.setProperty('--rs-input-focus-border', '#6366f1');
      root.style.setProperty('--rs-input-focus-shadow', 'rgba(99, 102, 241, 0.2)');
    } else {
      // Dark mode rsuite 변수들
      root.style.setProperty('--rs-bg-primary', '#1a1a1a');
      root.style.setProperty('--rs-bg-secondary', '#2d2d2d');
      root.style.setProperty('--rs-bg-tertiary', '#404040');
      root.style.setProperty('--rs-border-primary', '#404040');
      root.style.setProperty('--rs-border-secondary', '#555555');
      root.style.setProperty('--rs-text-primary', '#ffffff');
      root.style.setProperty('--rs-text-secondary', '#cccccc');
      root.style.setProperty('--rs-text-tertiary', '#999999');
      root.style.setProperty('--rs-text-disabled', '#666666');
      root.style.setProperty('--rs-input-bg', '#2d2d2d');
      root.style.setProperty('--rs-input-border', '#555555');
      root.style.setProperty('--rs-input-text', '#ffffff');
      root.style.setProperty('--rs-input-focus-border', '#6366f1');
      root.style.setProperty('--rs-input-focus-shadow', 'rgba(99, 102, 241, 0.2)');
    }
  }, [themeMode]);

  const value = {
    themeMode,
    toggleTheme,
    isDark: themeMode === 'dark',
    isBright: themeMode === 'bright',
    rsuiteTheme: getRsuiteTheme(),
    colors: {
      ...colors,
      current: getCurrentThemeColors()
    }
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}; 