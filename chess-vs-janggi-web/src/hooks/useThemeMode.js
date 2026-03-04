import { useEffect, useState } from 'react';

// 테마 모드를 저장할 localStorage 키입니다.
const THEME_STORAGE_KEY = 'cj-theme-mode';

// 현재 테마 상태를 관리하고 DOM/저장소와 동기화합니다.
export function useThemeMode() {
  const [themeMode, setThemeMode] = useState(() => {
    const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
    return savedMode === 'dark' ? 'dark' : 'light';
  });

  // 테마가 바뀔 때 html[data-theme]와 localStorage를 함께 갱신합니다.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  // light/dark 값을 토글합니다.
  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return {
    themeMode,
    toggleTheme,
    setThemeMode,
  };
}
