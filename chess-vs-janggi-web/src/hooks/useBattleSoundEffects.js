import { useEffect, useRef } from 'react';

// 시작/승패 사운드 재생 타이밍을 공통 처리하고 중복 재생을 방지합니다.
export function useBattleSoundEffects({ started, winner, mySide, warningSoundEnabled, playEventSound }) {
  // 시작 사운드 1회 재생 제어용 캐시입니다.
  const prevStartedSoundRef = useRef(false);
  // 승패 사운드 중복 재생 방지용 캐시입니다.
  const prevWinnerSoundRef = useRef(null);

  // 게임이 시작되는 순간에만 start 사운드를 1회 재생합니다.
  useEffect(() => {
    if (started && !prevStartedSoundRef.current) {
      playEventSound?.('start');
    }
    if (!started) {
      prevWinnerSoundRef.current = null;
    }
    prevStartedSoundRef.current = started;
  }, [started, warningSoundEnabled, playEventSound]);

  // 승자 확정 시 내 진영 기준으로 win/lose 사운드를 1회 재생합니다.
  useEffect(() => {
    if (!winner) {
      prevWinnerSoundRef.current = null;
      return;
    }
    if (prevWinnerSoundRef.current === winner) return;

    playEventSound?.(winner === mySide ? 'win' : 'lose');
    prevWinnerSoundRef.current = winner;
  }, [winner, mySide, warningSoundEnabled, playEventSound]);
}
