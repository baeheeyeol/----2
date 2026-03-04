export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SOCKET_ERROR: 'socket_error',

  LOGIN: 'login',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_ERROR: 'login_error',
  LOGOUT: 'logout',
  USER_COUNT: 'user_count',
  USER_PROFILE_UPDATED: 'user_profile_updated',

  SEND_MESSAGE: 'send_message',
  RECEIVE_MESSAGE: 'receive_message',
  SEND_ROOM_MESSAGE: 'send_room_message',
  RECEIVE_ROOM_MESSAGE: 'receive_room_message',

  CREATE_ROOM: 'create_room',
  CREATE_ROOM_SUCCESS: 'create_room_success',
  CREATE_ROOM_ERROR: 'create_room_error',

  JOIN_ROOM: 'join_room',
  JOIN_ROOM_SUCCESS: 'join_room_success',
  JOIN_ROOM_ERROR: 'join_room_error',

  UPDATE_ROOM_SETTINGS: 'update_room_settings',
  UPDATE_ROOM_SETTINGS_ERROR: 'update_room_settings_error',

  LEAVE_ROOM: 'leave_room',
  LEAVE_ROOM_SUCCESS: 'leave_room_success',
  REQUEST_ROOM_LIST: 'request_room_list',
  ROOM_LIST: 'room_list',
  ROOM_UPDATE: 'room_update',
  ROOM_CLOSED: 'room_closed',

  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  FORFEIT_RESULT: 'forfeit_result',
};

export const SOCKET_ERROR_EVENTS = [
  SOCKET_EVENTS.SOCKET_ERROR,
  SOCKET_EVENTS.LOGIN_ERROR,
  SOCKET_EVENTS.CREATE_ROOM_ERROR,
  SOCKET_EVENTS.JOIN_ROOM_ERROR,
  SOCKET_EVENTS.UPDATE_ROOM_SETTINGS_ERROR,
];

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value) => typeof value === 'string';
const isNonEmptyString = (value) => isString(value) && value.trim().length > 0;
const isBoolean = (value) => typeof value === 'boolean';
const isFiniteNumber = (value) => Number.isFinite(Number(value));
const isNullableString = (value) => value === null || isString(value);

const ROOM_STATUS_VALUES = new Set(['WAITING', 'PLAYING']);
const ROOM_RULE_VALUES = new Set(['자율선택', '랜덤배정', '방장선택', 'auto', 'AUTO', 'FREE', 'RANDOM', 'HOST']);
const ROOM_MAP_VALUES = new Set(['체스판', '장기판', '바둑판', 'chess', 'janggi', 'omok', 'baduk']);
const FACTION_VALUES = new Set(['chess', 'janggi', 'omok']);
const COLOR_VALUES = new Set(['white', 'black', 'red', 'blue', 'green', 'gold', 'purple']);

const isLayoutItem = (value) => { 
  return isObject(value)
    && isString(value.type)
    && isFiniteNumber(value.row)
    && isFiniteNumber(value.col)
    && FACTION_VALUES.has(String(value.faction || '')); 
};

const isPieceLike = (value) => {
  if (value === null) return true;
  return isObject(value)
    && isString(value.type)
    && isString(value.side)
    && isString(value.faction);
};

const isBattleBoardLike = (value) => {
  if (value === null) return true;
  if (!Array.isArray(value) || value.length === 0) return false;
  const rowLength = Array.isArray(value[0]) ? value[0].length : 0;
  if (rowLength <= 0) return false;
  return value.every((row) => Array.isArray(row) && row.length === rowLength && row.every(isPieceLike));
};

const isGameSetup = (value) => {
  if (!isObject(value)) return false;
  if (!isBoolean(value.started)) return false;
  if (!(value.firstTurn === null || value.firstTurn === 'top' || value.firstTurn === 'bottom')) return false;
  if (!(value.turnSide === null || value.turnSide === 'top' || value.turnSide === 'bottom')) return false;
  if (!(value.winner === null || value.winner === 'top' || value.winner === 'bottom')) return false;
  if (!isBattleBoardLike(value.battleBoard ?? null)) return false;
  if (!isObject(value.capturedBySide || {})) return false;
  if (!Array.isArray(value.capturedBySide.top || [])) return false;
  if (!Array.isArray(value.capturedBySide.bottom || [])) return false;
  if (!isBoolean(value.p1Ready)) return false;
  if (!isBoolean(value.p2Ready)) return false;
  if (!Array.isArray(value.p1CustomLayout || []) || !value.p1CustomLayout.every(isLayoutItem)) return false;
  if (!Array.isArray(value.p2CustomLayout || []) || !value.p2CustomLayout.every(isLayoutItem)) return false;
  return true;
};

const isRoomPayload = (value) => {
  if (!isObject(value)) return false;
  if (!isNonEmptyString(value.id)) return false;
  if (!isNonEmptyString(value.title)) return false;
  if (!isNonEmptyString(value.p1)) return false;
  if (!isNullableString(value.p2)) return false;
  if (!ROOM_STATUS_VALUES.has(String(value.status || ''))) return false;
  if (!ROOM_RULE_VALUES.has(String(value.roomRule || ''))) return false;
  if (!ROOM_MAP_VALUES.has(String(value.roomMap || ''))) return false;
  if (!FACTION_VALUES.has(String(value.p1Faction || ''))) return false;
  if (!FACTION_VALUES.has(String(value.p2Faction || ''))) return false;
  if (!COLOR_VALUES.has(String(value.p1Color || ''))) return false;
  if (!COLOR_VALUES.has(String(value.p2Color || ''))) return false;
  if (!isFiniteNumber(value.omokStoneTarget)) return false;
  if (!isFiniteNumber(value.turnSeconds)) return false;
  if (!isBoolean(value.p1Ready)) return false;
  if (!isBoolean(value.p2Ready)) return false;
  if (!isBoolean(value.isPrivate)) return false;
  if (!isGameSetup(value.gameSetup)) return false;
  return true;
};

const payloadValidators = {
  [SOCKET_EVENTS.LOGIN]: (payload) => isObject(payload) && isNonEmptyString(payload.userId),
  [SOCKET_EVENTS.SEND_MESSAGE]: (payload) => isObject(payload) && isNonEmptyString(payload.text) && isString(payload.user || ''),
  [SOCKET_EVENTS.SEND_ROOM_MESSAGE]: (payload) => isObject(payload) && isNonEmptyString(payload.roomId) && isObject(payload.messageData),
  [SOCKET_EVENTS.CREATE_ROOM]: (payload) => isObject(payload) && isNonEmptyString(payload.creator_id),
  [SOCKET_EVENTS.JOIN_ROOM]: (payload) => isObject(payload) && isNonEmptyString(payload.roomId),
  [SOCKET_EVENTS.UPDATE_ROOM_SETTINGS]: (payload) => isObject(payload) && isNonEmptyString(payload.roomId) && isObject(payload.updates),
  [SOCKET_EVENTS.LEAVE_ROOM]: (payload) => isObject(payload) && isNonEmptyString(payload.roomId),

  [SOCKET_EVENTS.LOGIN_SUCCESS]: (payload) => isObject(payload) && isNonEmptyString(payload.id),
  [SOCKET_EVENTS.USER_PROFILE_UPDATED]: (payload) => isObject(payload) && isNonEmptyString(payload.id),
  [SOCKET_EVENTS.CREATE_ROOM_SUCCESS]: (payload) => isObject(payload) && isNonEmptyString(payload.id),
  [SOCKET_EVENTS.JOIN_ROOM_SUCCESS]: (payload) => isObject(payload) && isNonEmptyString(payload.id),
  [SOCKET_EVENTS.ROOM_UPDATE]: (payload) => isRoomPayload(payload),
  [SOCKET_EVENTS.ROOM_LIST]: (payload) => Array.isArray(payload) && payload.every(isRoomPayload),
  [SOCKET_EVENTS.FORFEIT_RESULT]: (payload) => isObject(payload) && isNonEmptyString(payload.winnerId) && isNonEmptyString(payload.loserId),

  [SOCKET_EVENTS.SOCKET_ERROR]: (payload) => isObject(payload) && isNonEmptyString(payload.message),
  [SOCKET_EVENTS.LOGIN_ERROR]: (payload) => isObject(payload) && isNonEmptyString(payload.message),
  [SOCKET_EVENTS.CREATE_ROOM_ERROR]: (payload) => isObject(payload) && isNonEmptyString(payload.message),
  [SOCKET_EVENTS.JOIN_ROOM_ERROR]: (payload) => isObject(payload) && isNonEmptyString(payload.message),
  [SOCKET_EVENTS.UPDATE_ROOM_SETTINGS_ERROR]: (payload) => isObject(payload) && isNonEmptyString(payload.message),
};

export function validateSocketPayload(eventName, payload) {
  const validator = payloadValidators[eventName];
  if (!validator) return true;
  return validator(payload);
}

export function getSocketErrorMessage(payload, fallbackMessage = '네트워크 오류가 발생했습니다.') {
  if (isObject(payload) && isNonEmptyString(payload.message)) {
    return payload.message.trim();
  }
  return fallbackMessage;
}
