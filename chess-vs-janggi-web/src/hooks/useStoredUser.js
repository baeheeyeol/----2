import { useCallback, useState } from 'react';

// 사용자 세션 정보를 localStorage에 저장할 때 사용하는 키입니다.
export const STORAGE_KEY = 'cj-user-info';

// localStorage에서 사용자 정보를 읽고, 파싱 실패 시 안전하게 초기화합니다.
export const getStoredUser = () => {
  try {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

// 사용자 상태와 localStorage를 동기화해 세션을 관리합니다.
export function useStoredUser() {
  const [user, setUser] = useState(() => getStoredUser());

  // 사용자 정보를 상태/저장소에 동시에 반영합니다(업데이터 함수 지원).
  const persistUser = useCallback((nextUserOrUpdater) => {
    setUser((prev) => {
      const nextUser = typeof nextUserOrUpdater === 'function'
        ? nextUserOrUpdater(prev)
        : nextUserOrUpdater;

      if (nextUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      return nextUser;
    });
  }, []);

  // 사용자 정보를 상태/저장소에서 모두 제거합니다.
  const clearUser = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return {
    user,
    setUser,
    persistUser,
    clearUser,
  };
}
