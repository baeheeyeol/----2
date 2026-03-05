import {
  OMOK_STONE_TARGET_DEFAULT,
  OMOK_STONE_TARGET_MAX,
  OMOK_STONE_TARGET_MIN,
  TURN_SECONDS_DEFAULT,
  TURN_SECONDS_MAX,
  TURN_SECONDS_MIN,
} from './constants/index.js';

const normalizeIntegerInRange = (value, { min, max, fallback }) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
};

export const normalizeOmokStoneTarget = (value, fallback = OMOK_STONE_TARGET_DEFAULT) => {
  return normalizeIntegerInRange(value, {
    min: OMOK_STONE_TARGET_MIN,
    max: OMOK_STONE_TARGET_MAX,
    fallback,
  });
};

export const normalizeTurnSeconds = (value, fallback = TURN_SECONDS_DEFAULT) => {
  return normalizeIntegerInRange(value, {
    min: TURN_SECONDS_MIN,
    max: TURN_SECONDS_MAX,
    fallback,
  });
};

const resolveReadyFlag = (roomReady, setupReady) => {
  if (typeof roomReady === 'boolean') return roomReady;
  if (typeof setupReady === 'boolean') return setupReady;
  return false;
};

export const resolveRoomReadyState = (room, gameSetup = room?.gameSetup) => {
  return {
    p1Ready: resolveReadyFlag(room?.p1Ready, gameSetup?.p1Ready),
    p2Ready: resolveReadyFlag(room?.p2Ready, gameSetup?.p2Ready),
  };
};
