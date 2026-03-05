import { useMemo } from 'react';
import { computeRemainingPool, resolvePlacementsForSide } from '../shared/computedStateUtils';
import { normalizeOmokStoneTarget, normalizeTurnSeconds, resolveRoomReadyState } from '@/game/room-settings';

// 체스 통합 보드의 배치/풀/제한값 파생 상태를 계산합니다.
export function useChessComputedState({
  gameSetup,
  myKey,
  opponentKey,
  room,
  myCustomLayout,
  opponentCustomLayout,
  myFaction,
  opponentFaction,
  mySide,
  opponentSide,
  myFormation,
  opponentFormation,
  opponentMode,
  effectiveMyMode,
  inBounds,
  getDefaultPlacementsForSide,
  getDefaultPieceTypes,
  buildBoardFromPlacements,
  formationKeys,
  janggiFormations,
  defaultStoneCaptureWinTarget,
}) {
  // 내 커스텀 배치에서 유효 좌표/진영만 남깁니다.
  const normalizedMyLayout = useMemo(
    () => myCustomLayout.filter((item) => inBounds(item.row, item.col) && item.faction === myFaction),
    [myCustomLayout, myFaction, inBounds],
  );

  // 상대 커스텀 배치에서 유효 좌표/진영만 남깁니다.
  const normalizedOpponentLayout = useMemo(
    () => opponentCustomLayout.filter((item) => inBounds(item.row, item.col) && item.faction === opponentFaction),
    [opponentCustomLayout, opponentFaction, inBounds],
  );

  // 내 진영의 기본 배치(추천/포진)를 계산합니다.
  const myDefaultPlacements = useMemo(
    () => getDefaultPlacementsForSide(myFaction, mySide, myFormation),
    [myFaction, mySide, myFormation, getDefaultPlacementsForSide],
  );

  // 상대 진영의 기본 배치(추천/포진)를 계산합니다.
  const opponentDefaultPlacements = useMemo(
    () => getDefaultPlacementsForSide(opponentFaction, opponentSide, opponentFormation),
    [opponentFaction, opponentSide, opponentFormation, getDefaultPlacementsForSide],
  );

  // 상단(Top) 진영의 실제 배치를 모드 기준으로 확정합니다.
  const setupTopPlacements = useMemo(
    () => resolvePlacementsForSide({
      targetSide: 'top',
      mySide,
      myFaction,
      opponentSide,
      opponentFaction,
      myMode: effectiveMyMode,
      opponentMode,
      myCustomLayout: normalizedMyLayout,
      opponentCustomLayout: normalizedOpponentLayout,
      myDefaultPlacements,
      opponentDefaultPlacements,
      canUseCustom: (_, mode) => mode === 'custom',
    }),
    [mySide, myFaction, opponentSide, opponentFaction, effectiveMyMode, opponentMode, normalizedMyLayout, normalizedOpponentLayout, myDefaultPlacements, opponentDefaultPlacements],
  );

  // 하단(Bottom) 진영의 실제 배치를 모드 기준으로 확정합니다.
  const setupBottomPlacements = useMemo(
    () => resolvePlacementsForSide({
      targetSide: 'bottom',
      mySide,
      myFaction,
      opponentSide,
      opponentFaction,
      myMode: effectiveMyMode,
      opponentMode,
      myCustomLayout: normalizedMyLayout,
      opponentCustomLayout: normalizedOpponentLayout,
      myDefaultPlacements,
      opponentDefaultPlacements,
      canUseCustom: (_, mode) => mode === 'custom',
    }),
    [mySide, myFaction, opponentSide, opponentFaction, effectiveMyMode, opponentMode, normalizedMyLayout, normalizedOpponentLayout, myDefaultPlacements, opponentDefaultPlacements],
  );

  // 상/하 배치를 기반으로 세팅 보드를 생성합니다.
  const setupBoard = useMemo(
    () => buildBoardFromPlacements(setupTopPlacements, setupBottomPlacements),
    [setupTopPlacements, setupBottomPlacements, buildBoardFromPlacements],
  );

  // 현재 진영/포진 기준 예비 기물 타입 목록을 생성합니다.
  const poolTypes = useMemo(
    () => getDefaultPieceTypes(myFaction, myFormation),
    [myFaction, myFormation, getDefaultPieceTypes],
  );

  // 아직 배치하지 않은 예비 기물 목록을 계산합니다.
  const unplacedPool = useMemo(() => computeRemainingPool(poolTypes, normalizedMyLayout), [poolTypes, normalizedMyLayout]);

  // 준비/시작 조건에서 자주 쓰는 파생 플래그를 계산합니다.
  const roomReadyState = resolveRoomReadyState(room, gameSetup);
  const myReady = myKey === 'p1' ? roomReadyState.p1Ready : roomReadyState.p2Ready;
  const opponentReady = opponentKey === 'p1' ? roomReadyState.p1Ready : roomReadyState.p2Ready;
  const canToggleReady = effectiveMyMode !== 'custom' || unplacedPool.length === 0;

  // 룸 설정 기반으로 턴 제한시간/돌 제거 승리 기준값을 정규화합니다.
  const turnLimitSeconds = normalizeTurnSeconds(room?.turnSeconds);
  const stoneCaptureWinTarget = normalizeOmokStoneTarget(room?.omokStoneTarget, defaultStoneCaptureWinTarget);

  // 장기 포진 선택 카드(UI)용 프리뷰 목록을 생성합니다.
  const formationPreviewItems = useMemo(
    () => formationKeys.map((key) => ({ key, ...janggiFormations[key] })),
    [formationKeys, janggiFormations],
  );

  return {
    normalizedMyLayout,
    setupTopPlacements,
    setupBottomPlacements,
    setupBoard,
    unplacedPool,
    myReady,
    opponentReady,
    canToggleReady,
    turnLimitSeconds,
    stoneCaptureWinTarget,
    formationPreviewItems,
  };
}
