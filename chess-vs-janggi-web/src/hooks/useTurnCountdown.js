import { useEffect, useRef, useState } from 'react';

// 턴 제한시간 카운트다운을 공통 처리합니다.
export function useTurnCountdown({
  started,
  winner,
  turnToken,
  limitSeconds,
  isHost,
  warningEnabled,
  warningThreshold = 5,
  onWarning,
  onTimeout,
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(limitSeconds);
  const lastWarningSecondRef = useRef(null);
  const timeoutFiredTokenRef = useRef(null);

  // 게임 시작/턴 변경/제한시간 변경 시 카운트다운과 내부 캐시를 초기화합니다.
  useEffect(() => {
    setRemainingSeconds(limitSeconds);
    lastWarningSecondRef.current = null;
    timeoutFiredTokenRef.current = null;
  }, [started, winner, turnToken, limitSeconds]);

  // 게임 진행 중일 때 1초 간격으로 남은 시간을 감소시킵니다.
  useEffect(() => {
    if (!started || winner) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, winner, turnToken]);

  // 경고 구간(기본 5초 이하)에서 초당 1회만 경고 콜백을 호출합니다.
  useEffect(() => {
    if (!started || winner || !warningEnabled) return;
    if (remainingSeconds <= 0 || remainingSeconds > warningThreshold) return;
    if (lastWarningSecondRef.current === remainingSeconds) return;

    lastWarningSecondRef.current = remainingSeconds;
    onWarning?.(remainingSeconds);
  }, [started, winner, warningEnabled, warningThreshold, remainingSeconds, onWarning]);

  // 시간이 0초가 되면 호스트에서만 타임아웃 콜백을 1회 호출합니다.
  useEffect(() => {
    if (!started || winner || !isHost) return;
    if (remainingSeconds > 0) return;

    const timeoutToken = String(turnToken ?? 'default');
    if (timeoutFiredTokenRef.current === timeoutToken) return;

    timeoutFiredTokenRef.current = timeoutToken;
    onTimeout?.();
  }, [started, winner, isHost, remainingSeconds, turnToken, onTimeout]);

  return remainingSeconds;
}
