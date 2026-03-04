import { useMemo } from 'react';
import { computeRemainingPool, resolvePlacementsForSide } from '../shared/computedStateUtils';

// 장기 화면의 배치/보드/풀 관련 파생 상태를 한 곳에서 계산합니다.
export function useJanggiComputedState({
  gameSetup,
  myKey,
  opponentKey,
  mySide,
  myFaction,
  opponentFaction,
  myMode,
  myRecommendedSide,
  opponentRecommendedSide,
  myCustomLayout,
  opponentCustomLayout,
  isMyChess,
  legalMoves,
  rows,
  chessPool,
  getJanggiFixedPlacements,
  getChessRecommendedPlacements,
  buildBoardFromPlacements,
}) {
  // 내 진영의 기본 배치(장기 고정/체스 추천/오목 없음)를 계산합니다.
  const myDefault = useMemo(() => {
    if (myFaction === 'janggi') return getJanggiFixedPlacements(mySide);
    if (myFaction === 'omok') return [];
    return getChessRecommendedPlacements(mySide, myRecommendedSide);
  }, [myFaction, mySide, myRecommendedSide, getJanggiFixedPlacements, getChessRecommendedPlacements]);

  // 상대 진영/모드 계산에 필요한 값입니다.
  const opponentSide = mySide === 'top' ? 'bottom' : 'top';
  const opponentMode = gameSetup[`${opponentKey}Mode`] || 'recommended';

  // 상대 진영의 기본 배치(장기 고정/체스 추천/오목 없음)를 계산합니다.
  const opponentDefault = useMemo(() => {
    if (opponentFaction === 'janggi') return getJanggiFixedPlacements(opponentSide);
    if (opponentFaction === 'omok') return [];
    return getChessRecommendedPlacements(opponentSide, opponentRecommendedSide);
  }, [opponentFaction, opponentSide, opponentRecommendedSide, getJanggiFixedPlacements, getChessRecommendedPlacements]);

  // 상단(Top) 진영의 실제 배치를 모드 기준으로 확정합니다.
  const topPlacements = useMemo(
    () => resolvePlacementsForSide({
      targetSide: 'top',
      mySide,
      myFaction,
      opponentSide,
      opponentFaction,
      myMode,
      opponentMode,
      myCustomLayout,
      opponentCustomLayout,
      myDefaultPlacements: myDefault,
      opponentDefaultPlacements: opponentDefault,
      canUseCustom: (faction, mode) => faction === 'chess' && mode === 'custom',
    }),
    [mySide, myFaction, opponentSide, opponentFaction, myMode, opponentMode, myCustomLayout, opponentCustomLayout, myDefault, opponentDefault],
  );

  // 하단(Bottom) 진영의 실제 배치를 모드 기준으로 확정합니다.
  const bottomPlacements = useMemo(
    () => resolvePlacementsForSide({
      targetSide: 'bottom',
      mySide,
      myFaction,
      opponentSide,
      opponentFaction,
      myMode,
      opponentMode,
      myCustomLayout,
      opponentCustomLayout,
      myDefaultPlacements: myDefault,
      opponentDefaultPlacements: opponentDefault,
      canUseCustom: (faction, mode) => faction === 'chess' && mode === 'custom',
    }),
    [mySide, myFaction, opponentSide, opponentFaction, myMode, opponentMode, myCustomLayout, opponentCustomLayout, myDefault, opponentDefault],
  );

  // 상/하 배치로 세팅 보드를 생성합니다.
  const setupBoard = useMemo(() => buildBoardFromPlacements(topPlacements, bottomPlacements), [topPlacements, bottomPlacements, buildBoardFromPlacements]);

  // 서버가 전달한 전투 보드가 있으면 사용하고, 없으면 세팅 보드를 사용합니다.
  const battleBoard = useMemo(() => {
    if (Array.isArray(gameSetup.battleBoard) && gameSetup.battleBoard.length === rows) return gameSetup.battleBoard;
    return setupBoard;
  }, [gameSetup.battleBoard, setupBoard, rows]);

  // 체스 자율배치에서 준비 가능 여부를 계산합니다.
  const myPlacedChess = myCustomLayout.filter((item) => item.faction === 'chess').length;
  const canReady = !(isMyChess && myMode === 'custom') || myPlacedChess >= chessPool.length;

  // 아직 배치하지 않은 예비 기물 목록을 계산합니다.
  const remainingPool = useMemo(() => computeRemainingPool(chessPool, myCustomLayout), [chessPool, myCustomLayout]);

  // legalMoves를 셀 강조용 Set으로 변환합니다.
  const legalSet = useMemo(() => new Set(legalMoves.map((m) => `${m.row}-${m.col}`)), [legalMoves]);

  return {
    opponentMode,
    myDefault,
    opponentDefault,
    topPlacements,
    bottomPlacements,
    setupBoard,
    battleBoard,
    canReady,
    remainingPool,
    legalSet,
  };
}
