import { useEffect, useRef, useState } from 'react';
import {
  FACTIONS,
  GAME_RULES,
  MAP_TYPES,
  OMOK_STONE_TARGET_OPTIONS,
} from '@/game/constants';
import { normalizeOmokStoneTarget, normalizeTurnSeconds } from '@/game/room-settings';

export const normalizeRule = (rule) => {
  const ruleMap = {
    auto: GAME_RULES.FREE,
    AUTO: GAME_RULES.FREE,
    FREE: GAME_RULES.FREE,
    RANDOM: GAME_RULES.RANDOM,
    HOST: GAME_RULES.HOST,
    [GAME_RULES.FREE]: GAME_RULES.FREE,
    [GAME_RULES.RANDOM]: GAME_RULES.RANDOM,
    [GAME_RULES.HOST]: GAME_RULES.HOST,
  };

  return ruleMap[rule] || GAME_RULES.FREE;
};

export const getFactionByCode = (factionCode, fallback = FACTIONS.CHESS) => {
  return Object.values(FACTIONS).find((faction) => faction.code === factionCode) || fallback;
};

export function useRoomSetup({ room, user, onUpdateRoomSettings, isHost, isP2Joined, isP1Ready, isP2Ready, isHostSettingsDisabled }) {
  const selectedRule = normalizeRule(room?.roomRule);
  const selectedMap = room?.roomMap || MAP_TYPES.CHESS;
  const p1Faction = getFactionByCode(room?.p1Faction, FACTIONS.CHESS);
  const p2Faction = getFactionByCode(room?.p2Faction, FACTIONS.JANGGI);
  const p1Color = room?.p1Color || 'white';
  const p2Color = room?.p2Color || 'black';
  const omokStoneTarget = normalizeOmokStoneTarget(room?.omokStoneTarget);
  const roomTurnSeconds = normalizeTurnSeconds(room?.turnSeconds);

  const [countdown, setCountdown] = useState(5);
  const [ruleChanged, setRuleChanged] = useState(false);
  const [mapChanged, setMapChanged] = useState(false);
  const [turnSecondsInput, setTurnSecondsInput] = useState(String(roomTurnSeconds));
  const [isDiceRolling, setIsDiceRolling] = useState(false);

  const isFirstSyncRef = useRef(true);
  const prevRuleRef = useRef(selectedRule);
  const prevMapRef = useRef(selectedMap);
  const prevRandomTickRef = useRef(room?.randomTick || 0);
  const diceRollTimerRef = useRef(null);

  const triggerDiceRollEffect = () => {
    if (diceRollTimerRef.current) {
      clearTimeout(diceRollTimerRef.current);
    }

    setIsDiceRolling(true);
    diceRollTimerRef.current = setTimeout(() => {
      setIsDiceRolling(false);
      diceRollTimerRef.current = null;
    }, 800);
  };

  useEffect(() => {
    let timerId;
    if (isP1Ready && isP2Ready) {
      setCountdown(5);
      timerId = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(5);
    }
    return () => {
      clearInterval(timerId);
    };
  }, [isP1Ready, isP2Ready]);

  useEffect(() => {
    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false;
      prevRuleRef.current = selectedRule;
      prevMapRef.current = selectedMap;
      prevRandomTickRef.current = room?.randomTick || 0;
      return;
    }

    if (prevRuleRef.current !== selectedRule) {
      setRuleChanged(true);
      const timerId = setTimeout(() => setRuleChanged(false), 700);
      prevRuleRef.current = selectedRule;
      return () => clearTimeout(timerId);
    }

    prevRuleRef.current = selectedRule;
  }, [selectedRule]);

  useEffect(() => {
    if (isFirstSyncRef.current) return;

    if (prevMapRef.current !== selectedMap) {
      setMapChanged(true);
      const timerId = setTimeout(() => setMapChanged(false), 700);
      prevMapRef.current = selectedMap;
      return () => clearTimeout(timerId);
    }

    prevMapRef.current = selectedMap;
  }, [selectedMap]);

  useEffect(() => {
    if (isFirstSyncRef.current) return;

    const currentRandomTick = room?.randomTick || 0;
    if (currentRandomTick !== prevRandomTickRef.current) {
      triggerDiceRollEffect();
      prevRandomTickRef.current = currentRandomTick;
    }
  }, [room?.randomTick]);

  useEffect(() => {
    return () => {
      if (diceRollTimerRef.current) {
        clearTimeout(diceRollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setTurnSecondsInput(String(roomTurnSeconds));
  }, [roomTurnSeconds]);

  const getIsOmokTargetEditable = () => {
    if (room?.status === 'PLAYING') return false;
    if (selectedRule === GAME_RULES.RANDOM) return false;
    if (room?.isBotRoom && isHost) return true;
    if (selectedRule === GAME_RULES.HOST) return isHost;

    const isP1Omok = p1Faction.code === 'omok';
    const isP2Omok = p2Faction.code === 'omok';
    const isCurrentP1 = user?.id === room?.p1;
    const isCurrentP2 = user?.id === room?.p2;

    return (isCurrentP1 && isP1Omok) || (isCurrentP2 && isP2Omok);
  };

  const handleRandomizeFactions = () => {
    if (isHostSettingsDisabled || !isP2Joined) return;

    triggerDiceRollEffect();

    const factionList = Object.values(FACTIONS);
    const nextP1 = factionList[Math.floor(Math.random() * factionList.length)];
    const nextP2 = factionList[Math.floor(Math.random() * factionList.length)];
    const mapList = Object.values(MAP_TYPES);
    const nextMap = mapList[Math.floor(Math.random() * mapList.length)];
    const nextStoneTarget = OMOK_STONE_TARGET_OPTIONS[Math.floor(Math.random() * OMOK_STONE_TARGET_OPTIONS.length)];

    onUpdateRoomSettings?.({
      p1Faction: nextP1.code,
      p2Faction: nextP2.code,
      roomMap: nextMap,
      omokStoneTarget: nextStoneTarget,
    });
  };

  const handleRuleChange = (e) => {
    if (isHostSettingsDisabled) return;

    const newRule = normalizeRule(e.target.value);
    onUpdateRoomSettings?.({ roomRule: newRule });

    if (newRule === GAME_RULES.RANDOM) {
      handleRandomizeFactions();
    }
  };

  const handleMapChange = (e) => {
    if (isHostSettingsDisabled) return;
    onUpdateRoomSettings?.({ roomMap: e.target.value });
  };

  const handleTurnSecondsChange = (e) => {
    const inputValue = e.target.value;
    setTurnSecondsInput(inputValue);
    if (isHostSettingsDisabled) return;
    if (inputValue === '') return;

    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed)) return;
    const normalized = normalizeTurnSeconds(parsed);
    onUpdateRoomSettings?.({ turnSeconds: normalized });
  };

  const handleTurnSecondsBlur = () => {
    if (turnSecondsInput === '' || !Number.isFinite(Number(turnSecondsInput))) {
      setTurnSecondsInput(String(roomTurnSeconds));
      return;
    }

    const normalized = normalizeTurnSeconds(Number(turnSecondsInput));
    setTurnSecondsInput(String(normalized));
    if (!isHostSettingsDisabled) {
      onUpdateRoomSettings?.({ turnSeconds: normalized });
    }
  };

  const handleOmokStoneTargetChange = (e) => {
    const parsed = Number(e.target.value);
    if (!Number.isFinite(parsed)) return;
    const normalized = normalizeOmokStoneTarget(parsed);
    if (!getIsOmokTargetEditable()) return;
    onUpdateRoomSettings?.({ omokStoneTarget: normalized });
  };

  const handleFactionChange = (playerKey, factionCode) => {
    const isTargetReady = playerKey === 'p1' ? isP1Ready : isP2Ready;
    if (room?.status === 'PLAYING' || isTargetReady) return;

    const newFaction = Object.values(FACTIONS).find((faction) => faction.code === factionCode);
    if (!newFaction) return;

    onUpdateRoomSettings?.({ [playerKey === 'p1' ? 'p1Faction' : 'p2Faction']: factionCode });
  };

  const handleReadyClick = () => {
    if (!isP2Joined) return;
    onUpdateRoomSettings?.(isHost ? { p1Ready: !isP1Ready } : { p2Ready: !isP2Ready });
  };

  return {
    selectedRule,
    selectedMap,
    p1Faction,
    p2Faction,
    p1Color,
    p2Color,
    omokStoneTarget,
    countdown,
    ruleChanged,
    mapChanged,
    turnSecondsInput,
    isDiceRolling,
    handleRuleChange,
    handleMapChange,
    handleTurnSecondsChange,
    handleTurnSecondsBlur,
    handleOmokStoneTargetChange,
    handleFactionChange,
    handleRandomizeFactions,
    handleReadyClick,
    getIsOmokTargetEditable,
  };
}