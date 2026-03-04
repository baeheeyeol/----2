import { useBattleSoundEffects } from './useBattleSoundEffects';
import { useTurnCountdown } from './useTurnCountdown';
import { useTurnStartNotice } from './useTurnStartNotice';

// 턴 제한/경고/시작 안내/승패 사운드를 단일 인터페이스로 묶어 제공합니다.
export function useTurnFeedback({
  started,
  winner,
  turnToken,
  firstTurnSide,
  currentTurnSide,
  mySide,
  limitSeconds,
  isHost,
  warningEnabled,
  warningThreshold = 5,
  onWarning,
  onTimeout,
  playEventSound,
}) {
  const remainingSeconds = useTurnCountdown({
    started,
    winner,
    turnToken,
    limitSeconds,
    isHost,
    warningEnabled,
    warningThreshold,
    onWarning,
    onTimeout,
  });

  const turnStartNotice = useTurnStartNotice({
    started,
    firstTurnSide,
    currentTurnSide,
    mySide,
  });

  useBattleSoundEffects({
    started,
    winner,
    mySide,
    warningSoundEnabled: warningEnabled,
    playEventSound,
  });

  return {
    remainingSeconds,
    turnStartNotice,
  };
}