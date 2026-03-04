import { useEffect, useRef, useState } from 'react';

// 게임 시작 직후 선/후턴 안내 문구를 짧게 노출합니다.
export function useTurnStartNotice({ started, firstTurnSide, currentTurnSide, mySide, duration = 1400 }) {
  const [notice, setNotice] = useState('');
  const prevStartedRef = useRef(false);
  const timerRef = useRef(null);

  // 시작 시점에만 선/후턴 문구를 설정하고 duration 이후 자동으로 숨깁니다.
  useEffect(() => {
    if (!started) {
      prevStartedRef.current = false;
      setNotice('');
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (!prevStartedRef.current) {
      const starter = firstTurnSide || currentTurnSide;
      setNotice(starter === mySide ? '선턴' : '후턴');

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setNotice('');
        timerRef.current = null;
      }, duration);
    }

    prevStartedRef.current = true;
  }, [started, firstTurnSide, currentTurnSide, mySide, duration]);

  // 컴포넌트 해제 시 남아 있는 타이머를 정리합니다.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return notice;
}
