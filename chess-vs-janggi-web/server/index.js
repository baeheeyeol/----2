import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { SOCKET_EVENTS, validateSocketPayload } from '../src/socket/socket-contract.js';

const app = express();
app.use(cors());

const server = http.createServer(app);

// Socket.io 설정
const io = new Server(server, {
  cors: {
    origin: "*", // 모든 오리진 허용 (개발 단계)
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true // 하위 호환성 유지
});

// --- [In-Memory Database] ---
let connectedUsers = {}; // { socketId: { id, winRate, rank } }
let userToSocketId = {}; // { userId: socketId }
let userRecords = {}; // { userId: { wins, losses, games } }
let rooms = []; 
let roomPasswords = {}; // { roomId: password }
// Room 구조: { id, title, p1, p1_socketId, p2, p2_socketId, status }

const normalizeBotLevel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(3, Math.max(1, Math.floor(parsed)));
};

const getBotUserId = (level) => `[BOT_LV${normalizeBotLevel(level)}]`;

const normalizeRoomRule = (rule) => {
  const ruleMap = {
    auto: '자율선택',
    AUTO: '자율선택',
    FREE: '자율선택',
    RANDOM: '랜덤배정',
    HOST: '방장선택',
    '자율선택': '자율선택',
    '랜덤배정': '랜덤배정',
    '방장선택': '방장선택'
  };

  return ruleMap[rule] || '자율선택';
};

const createDefaultGameSetup = () => ({
  started: false,
  firstTurn: null,
  turnSide: null,
  winner: null,
  winnerReason: null,
  battleBoard: null,
  lastMove: null,
  capturedBySide: { top: [], bottom: [] },
  p1Lives: 3,
  p2Lives: 3,
  p1Ready: false,
  p2Ready: false,
  p1Mode: 'formation',
  p2Mode: 'formation',
  p1RecommendedSide: 'left',
  p2RecommendedSide: 'left',
  p1Formation: null,
  p2Formation: null,
  p1CustomLayout: [],
  p2CustomLayout: []
});

const normalizeOmokStoneTarget = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 8;
  return Math.min(12, Math.max(6, Math.floor(parsed)));
};

const getOrCreateUserRecord = (userId) => {
  if (!userRecords[userId]) {
    userRecords[userId] = { wins: 0, losses: 0, games: 0 };
  }
  return userRecords[userId];
};

const getWinRatePercent = (record) => {
  if (!record || record.games <= 0) return 0;
  return Math.round((record.wins / record.games) * 100);
};

const getRankingList = () => {
  return Object.entries(userRecords)
    .map(([id, record]) => ({ id, ...record }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      if (b.games !== a.games) return b.games - a.games;
      return a.id.localeCompare(b.id);
    });
};

const buildUserProfile = (userId) => {
  const record = getOrCreateUserRecord(userId);
  const ranking = getRankingList();
  const rankIndex = ranking.findIndex((entry) => entry.id === userId);

  return {
    id: userId,
    wins: record.wins,
    losses: record.losses,
    games: record.games,
    winRate: getWinRatePercent(record),
    rank: rankIndex >= 0 ? rankIndex + 1 : ranking.length,
  };
};

const syncConnectedUserProfile = (userId) => {
  const socketId = userToSocketId[userId];
  if (!socketId) return;
  if (!io.sockets.sockets.has(socketId)) return;

  const profile = buildUserProfile(userId);
  connectedUsers[socketId] = profile;
  io.to(socketId).emit(SOCKET_EVENTS.USER_PROFILE_UPDATED, profile);
};

const resolvePlayerSides = (room) => {
  const p1Faction = room?.p1Faction;
  const p2Faction = room?.p2Faction;
  const p1Side = p1Faction === 'chess' && p2Faction !== 'chess'
    ? 'bottom'
    : p2Faction === 'chess' && p1Faction !== 'chess'
      ? 'top'
      : 'bottom';
  const p2Side = p1Side === 'bottom' ? 'top' : 'bottom';
  return { p1Side, p2Side };
};

const applyMatchResult = (room, winnerSide) => {
  if (!room?.p1 || !room?.p2) return;
  if (winnerSide !== 'top' && winnerSide !== 'bottom') return;

  const { p1Side, p2Side } = resolvePlayerSides(room);
  const winnerId = winnerSide === p1Side ? room.p1 : winnerSide === p2Side ? room.p2 : null;
  const loserId = winnerId === room.p1 ? room.p2 : room.p1;
  if (!winnerId || !loserId) return;

  const winnerRecord = getOrCreateUserRecord(winnerId);
  winnerRecord.wins += 1;
  winnerRecord.games += 1;

  const loserRecord = getOrCreateUserRecord(loserId);
  loserRecord.losses += 1;
  loserRecord.games += 1;

  syncConnectedUserProfile(winnerId);
  syncConnectedUserProfile(loserId);
};

const emitSocketError = (socket, message, eventName = null) => {
  socket.emit(SOCKET_EVENTS.SOCKET_ERROR, {
    message,
    event: eventName || undefined,
  });
};

/**
 * [Helper] 유저가 방에서 나갈 때의 공통 처리 로직
 * - 방장(P1)이 나가면 방이 폭파됨.
 * - 참가자(P2)가 나가면 방은 유지되고 P2 자리가 빔.
 */
const handleUserExitRoom = (socketId) => {
  let isRoomListChanged = false;

  // filter를 사용하여 방 목록을 갱신 (방장이 나간 방은 제외)
  rooms = rooms.filter(room => {
    const isInGame = room?.status === 'PLAYING' && room?.gameSetup?.started;
    const hasNoWinnerYet = !room?.gameSetup?.winner;

    // 1. 방장(P1)이 나가는 경우 -> 방 삭제
    if (room.p1_socketId === socketId) {
      if (isInGame && hasNoWinnerYet && room.p2) {
        const { p1Side } = resolvePlayerSides(room);
        const winnerSide = p1Side === 'top' ? 'bottom' : 'top';
        applyMatchResult(room, winnerSide);

        const winnerId = room.p2;
        const loserId = room.p1;
        const winnerSocketId = room.p2_socketId;
        if (winnerSocketId && io.sockets.sockets.has(winnerSocketId)) {
          io.to(winnerSocketId).emit(SOCKET_EVENTS.FORFEIT_RESULT, { winnerId, loserId });
        }
      }

      console.log(`[Room Deleted] Creator left: ${room.id}`);
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_CLOSED, {
        roomId: room.id,
        message: '방장이 방을 떠나 로비로 이동합니다.'
      });
      io.in(room.id).socketsLeave(room.id);
      delete roomPasswords[room.id];
      isRoomListChanged = true;
      return false; // 목록에서 제외
    }

    // 2. 참가자(P2)가 나가는 경우 -> 방 유지, P2 정보 초기화
    if (room.p2_socketId === socketId) {
      if (isInGame && hasNoWinnerYet && room.p1) {
        const { p2Side } = resolvePlayerSides(room);
        const winnerSide = p2Side === 'top' ? 'bottom' : 'top';
        applyMatchResult(room, winnerSide);

        const winnerId = room.p1;
        const loserId = room.p2;
        if (room.p1_socketId && io.sockets.sockets.has(room.p1_socketId)) {
          io.to(room.p1_socketId).emit(SOCKET_EVENTS.FORFEIT_RESULT, { winnerId, loserId });
        }
        if (room.p2_socketId && io.sockets.sockets.has(room.p2_socketId)) {
          io.to(room.p2_socketId).emit(SOCKET_EVENTS.FORFEIT_RESULT, { winnerId, loserId });
        }
      }

      console.log(`[Player Left] P2 left room: ${room.id}`);
      const leftUser = room.p2;
      room.p2 = null;
      room.p2_socketId = null;
      room.status = 'WAITING'; // 다시 대기 상태로 변경
      room.p2Faction = 'janggi';
      room.p2Color = 'black';
      room.p1Ready = false;
      room.p2Ready = false;
      room.gameSetup = createDefaultGameSetup();
      
      // 해당 방에 있는 사람들에게 알림
      io.to(room.id).emit(SOCKET_EVENTS.PLAYER_LEFT, { user: leftUser });
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
      
      isRoomListChanged = true;
      return true; // 목록 유지
    }

    return true; // 관련 없는 방은 유지
  });

  // 변경사항이 있으면 로비에 있는 모든 사람에게 방 목록 방송
  if (isRoomListChanged) {
    io.emit(SOCKET_EVENTS.ROOM_LIST, rooms);
  }
};


// --- [Socket Event Handlers] ---
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  const onClientEvent = (eventName, handler) => {
    socket.on(eventName, (payload) => {
      if (!validateSocketPayload(eventName, payload)) {
        emitSocketError(socket, '잘못된 요청 형식입니다.', eventName);
        return;
      }
      handler(payload);
    });
  };

  // 1. 로그인 요청
  onClientEvent(SOCKET_EVENTS.LOGIN, ({ userId }) => {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

    if (!normalizedUserId) {
      socket.emit(SOCKET_EVENTS.LOGIN_ERROR, { message: '유효한 ID를 입력해주세요.' });
      return;
    }

    // 이미 접속 중인 ID 처리
    const existingSocketId = userToSocketId[normalizedUserId];
    if (existingSocketId && existingSocketId !== socket.id) {
        // 실제 연결이 살아있는지 확인
        if (io.sockets.sockets.has(existingSocketId)) {
            socket.emit(SOCKET_EVENTS.LOGIN_ERROR, { message: '이미 접속 중인 ID입니다.' });
            return;
        }
        delete userToSocketId[normalizedUserId];
    }

    // 사용자 정보 생성 및 저장
    const userInfo = buildUserProfile(normalizedUserId);

    connectedUsers[socket.id] = userInfo;
    userToSocketId[normalizedUserId] = socket.id;

    socket.emit(SOCKET_EVENTS.LOGIN_SUCCESS, userInfo);
    io.emit(SOCKET_EVENTS.USER_COUNT, Object.keys(connectedUsers).length);
  });

  // 2. 로비 채팅
  onClientEvent(SOCKET_EVENTS.SEND_MESSAGE, (messageData) => {
    io.emit(SOCKET_EVENTS.RECEIVE_MESSAGE, messageData);
  });

  // 2-2. 인게임/대기실 채팅
  onClientEvent(SOCKET_EVENTS.SEND_ROOM_MESSAGE, ({ roomId, messageData }) => {
    if (roomId && io.sockets.adapter.rooms.has(roomId)) {
       io.to(roomId).emit(SOCKET_EVENTS.RECEIVE_ROOM_MESSAGE, messageData);
    }
  });

  // 3. 연결 종료 (브라우저 닫음 등)
  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    console.log(`User Disconnected: ${socket.id}`);
    
    // 유저 정보 삭제
    const disconnectedUser = connectedUsers[socket.id];
    if (disconnectedUser) {
        delete userToSocketId[disconnectedUser.id];
        delete connectedUsers[socket.id];
    }

    // 방 처리 로직 실행
    handleUserExitRoom(socket.id);
    
    // 접속자 수 갱신
    io.emit(SOCKET_EVENTS.USER_COUNT, Object.keys(connectedUsers).length);
  });

  // 4. 로그아웃 (버튼 클릭)
  socket.on(SOCKET_EVENTS.LOGOUT, () => {
    const currentUser = connectedUsers[socket.id];
    if (currentUser) {
        delete userToSocketId[currentUser.id];
        delete connectedUsers[socket.id];
    }
    
    // 방 처리 로직 실행 (중복 제거됨)
    handleUserExitRoom(socket.id);

    io.emit(SOCKET_EVENTS.USER_COUNT, Object.keys(connectedUsers).length);
  });

  // 5. 방 만들기
  onClientEvent(SOCKET_EVENTS.CREATE_ROOM, (roomData) => {
    const currentUser = connectedUsers[socket.id];
    if (!currentUser) {
      socket.emit(SOCKET_EVENTS.CREATE_ROOM_ERROR, { message: '로그인이 필요합니다.' });
      return;
    }
    
    const isBotRoom = !!roomData.isBotRoom;
    const botLevel = normalizeBotLevel(roomData.botLevel);
    const initialGameSetup = createDefaultGameSetup();
    if (isBotRoom) {
      initialGameSetup.p2Ready = true;
    }

    const newRoom = {
      id: `room_${Date.now()}`,
      title: roomData.roomTitle || `${currentUser.id}님의 게임`, // 제목 없을 시 기본값
      p1: currentUser.id,
      p1_socketId: socket.id,
      p2: isBotRoom ? getBotUserId(botLevel) : null,
      p2_socketId: null,
      status: 'WAITING',
      roomRule: normalizeRoomRule(roomData.roomRule),
      roomMap: roomData.roomMap || '체스판',
      p1Faction: roomData.p1Faction || 'chess',
      p2Faction: roomData.p2Faction || 'janggi',
      p1Color: roomData.p1Color || 'white',
      p2Color: roomData.p2Color || 'black',
      omokStoneTarget: normalizeOmokStoneTarget(roomData.omokStoneTarget),
      turnSeconds: Number.isFinite(Number(roomData.turnSeconds)) ? Math.min(600, Math.max(1, Number(roomData.turnSeconds))) : 60,
      randomTick: 0,
      p1Ready: false,
      p2Ready: isBotRoom,
      isBotRoom,
      botLevel,
      isPrivate: !!roomData.isPrivate,
      gameSetup: initialGameSetup
    };

    if (newRoom.isPrivate) {
      roomPasswords[newRoom.id] = typeof roomData.roomPassword === 'string' ? roomData.roomPassword : '';
    }

    rooms.push(newRoom);
    socket.join(newRoom.id);
    
    io.emit(SOCKET_EVENTS.ROOM_LIST, rooms);
    socket.emit(SOCKET_EVENTS.CREATE_ROOM_SUCCESS, newRoom);
  });

  // 6. 방 입장
  onClientEvent(SOCKET_EVENTS.JOIN_ROOM, ({ roomId, roomPassword }) => { // 변수명 roomId로 통일
    const currentUser = connectedUsers[socket.id];
    if (!currentUser) {
      socket.emit(SOCKET_EVENTS.JOIN_ROOM_ERROR, { message: '로그인이 필요합니다.' });
      return;
    }

    const room = rooms.find(r => r.id === roomId);
    
    if (!room) {
      socket.emit(SOCKET_EVENTS.JOIN_ROOM_ERROR, { message: '존재하지 않는 방입니다.' });
      return;
    }

    if (room.isPrivate) {
      const expected = roomPasswords[room.id] || '';
      const provided = typeof roomPassword === 'string' ? roomPassword : '';
      if (!expected || expected !== provided) {
        socket.emit(SOCKET_EVENTS.JOIN_ROOM_ERROR, { message: '비밀번호가 올바르지 않습니다.' });
        return;
      }
    }

    if (room.status === 'WAITING' && !room.p2) {
      room.p2 = currentUser.id;
      room.p2_socketId = socket.id;
      room.status = 'WAITING';
      room.p1Ready = false;
      room.p2Ready = false;
      room.gameSetup = createDefaultGameSetup();
      
      socket.join(room.id);
      
      io.emit(SOCKET_EVENTS.ROOM_LIST, rooms); // 로비 갱신
      socket.emit(SOCKET_EVENTS.JOIN_ROOM_SUCCESS, room); // 본인에게 알림
      io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room); // 방 참가자(P1/P2) 상세 정보 갱신
      
      // 방에 있는 P1에게도 알림 (게임 시작 신호 등)
      io.to(room.id).emit(SOCKET_EVENTS.PLAYER_JOINED, { p2: currentUser.id });
      
    } else {
      socket.emit(SOCKET_EVENTS.JOIN_ROOM_ERROR, { message: '방이 꽉 찼거나 게임 중입니다.' });
    }
  });

  onClientEvent(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS, ({ roomId, updates }) => {
    const currentUser = connectedUsers[socket.id];
    if (!currentUser) {
      socket.emit(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS_ERROR, { message: '로그인이 필요합니다.' });
      return;
    }

    const room = rooms.find(r => r.id === roomId);
    if (!room) {
      socket.emit(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS_ERROR, { message: '존재하지 않는 방입니다.' });
      return;
    }

    const isParticipant = room.p1_socketId === socket.id || room.p2_socketId === socket.id;
    if (!isParticipant) {
      socket.emit(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS_ERROR, { message: '방 참가자만 설정을 변경할 수 있습니다.' });
      return;
    }

    const allowedRules = new Set(['자율선택', '랜덤배정', '방장선택']);
    const allowedMaps = new Set(['체스판', '장기판', '바둑판']);
    const allowedFactions = new Set(['chess', 'janggi', 'omok']);
    const allowedColors = new Set(['white', 'black', 'red', 'blue', 'green', 'gold', 'purple']);
    const setupModeSet = new Set(['formation', 'recommended', 'custom']);

    if (typeof updates !== 'object' || !updates) {
      socket.emit(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS_ERROR, { message: '잘못된 설정 요청입니다.' });
      return;
    }

    const isRandomShuffleRequest =
      !!updates.p1Faction &&
      !!updates.p2Faction &&
      allowedFactions.has(updates.p1Faction) &&
      allowedFactions.has(updates.p2Faction);

    const isHostSocket = room.p1_socketId === socket.id;

    if (updates.roomRule) {
      const normalizedRule = normalizeRoomRule(updates.roomRule);
      if (allowedRules.has(normalizedRule)) {
        room.roomRule = normalizedRule;
        room.p1Ready = false;
        room.p2Ready = false;
      }
    }

    if (updates.roomMap && allowedMaps.has(updates.roomMap)) {
      room.roomMap = updates.roomMap;
      room.p1Ready = false;
      room.p2Ready = false;
    }

    if (updates.p1Faction && allowedFactions.has(updates.p1Faction)) {
      room.p1Faction = updates.p1Faction;
      room.p1Ready = false;
      room.gameSetup = createDefaultGameSetup();
    }

    if (updates.p2Faction && allowedFactions.has(updates.p2Faction)) {
      room.p2Faction = updates.p2Faction;
      room.p2Ready = false;
      room.gameSetup = createDefaultGameSetup();
    }

    if (updates.p1Color && allowedColors.has(updates.p1Color)) {
      room.p1Color = updates.p1Color;
    }

    if (updates.p2Color && allowedColors.has(updates.p2Color)) {
      room.p2Color = updates.p2Color;
    }

    if (updates.omokStoneTarget !== undefined) {
      const roomRule = normalizeRoomRule(room.roomRule);
      const nextP1Faction = updates.p1Faction && allowedFactions.has(updates.p1Faction) ? updates.p1Faction : room.p1Faction;
      const nextP2Faction = updates.p2Faction && allowedFactions.has(updates.p2Faction) ? updates.p2Faction : room.p2Faction;
      const isP1Omok = nextP1Faction === 'omok';
      const isP2Omok = nextP2Faction === 'omok';
      const isRequesterP1 = room.p1_socketId === socket.id;
      const isRequesterP2 = room.p2_socketId === socket.id;

      const canEditOmokTarget =
        (roomRule === '방장선택' && isHostSocket) ||
        (roomRule === '자율선택' && ((isRequesterP1 && isP1Omok) || (isRequesterP2 && isP2Omok)));

      if (canEditOmokTarget) {
        room.omokStoneTarget = normalizeOmokStoneTarget(updates.omokStoneTarget);
        room.p1Ready = false;
        room.p2Ready = false;
      }
    }

    if (updates.turnSeconds !== undefined) {
      const numericTurnSeconds = Number(updates.turnSeconds);
      if (Number.isFinite(numericTurnSeconds)) {
        room.turnSeconds = Math.min(600, Math.max(1, Math.floor(numericTurnSeconds)));
      }
    }

    if (updates.p2Ready !== undefined) {
      room.p2Ready = !!updates.p2Ready;
    }
    if (updates.p1Ready !== undefined) {
      room.p1Ready = !!updates.p1Ready;
    }

    if (isRandomShuffleRequest) {
      room.randomTick = (room.randomTick || 0) + 1;
    }

    if (updates.gameSetup && typeof updates.gameSetup === 'object') {
      const previousWinner = room.gameSetup?.winner ?? null;
      const nextSetup = { ...(room.gameSetup || createDefaultGameSetup()) };

      if (typeof updates.gameSetup.started === 'boolean') {
        nextSetup.started = updates.gameSetup.started;
      }
      if (updates.gameSetup.firstTurn === 'top' || updates.gameSetup.firstTurn === 'bottom' || updates.gameSetup.firstTurn === null) {
        nextSetup.firstTurn = updates.gameSetup.firstTurn;
      }
      if (updates.gameSetup.turnSide === 'top' || updates.gameSetup.turnSide === 'bottom' || updates.gameSetup.turnSide === null) {
        nextSetup.turnSide = updates.gameSetup.turnSide;
      }
      if (updates.gameSetup.winner === 'top' || updates.gameSetup.winner === 'bottom' || updates.gameSetup.winner === null) {
        nextSetup.winner = updates.gameSetup.winner;
      }
      if (updates.gameSetup.winnerReason === 'capture' || updates.gameSetup.winnerReason === 'checkmate' || updates.gameSetup.winnerReason === 'timeout' || updates.gameSetup.winnerReason === 'connect5' || updates.gameSetup.winnerReason === null) {
        nextSetup.winnerReason = updates.gameSetup.winnerReason;
      }
      if (Array.isArray(updates.gameSetup.battleBoard)) {
        const rowCount = updates.gameSetup.battleBoard.length;
        const firstRow = rowCount > 0 && Array.isArray(updates.gameSetup.battleBoard[0]) ? updates.gameSetup.battleBoard[0] : null;
        const colCount = firstRow ? firstRow.length : 0;
        const isUniform = rowCount > 0 && updates.gameSetup.battleBoard.every((row) => Array.isArray(row) && row.length === colCount);
        const isAllowedSize = isUniform && ((rowCount === 8 && colCount === 8) || (rowCount === 10 && colCount === 9) || (rowCount === 15 && colCount === 15));
        if (isAllowedSize) {
          nextSetup.battleBoard = updates.gameSetup.battleBoard.map((row) => row.slice());
        }
      }
      if (updates.gameSetup.lastMove === null || typeof updates.gameSetup.lastMove === 'object') {
        nextSetup.lastMove = updates.gameSetup.lastMove;
      }
      if (updates.gameSetup.capturedBySide && typeof updates.gameSetup.capturedBySide === 'object') {
        const top = Array.isArray(updates.gameSetup.capturedBySide.top) ? updates.gameSetup.capturedBySide.top : [];
        const bottom = Array.isArray(updates.gameSetup.capturedBySide.bottom) ? updates.gameSetup.capturedBySide.bottom : [];
        nextSetup.capturedBySide = { top, bottom };
      }
      if (typeof updates.gameSetup.p1Ready === 'boolean') {
        nextSetup.p1Ready = updates.gameSetup.p1Ready;
      }
      if (typeof updates.gameSetup.p2Ready === 'boolean') {
        nextSetup.p2Ready = updates.gameSetup.p2Ready;
      }
      if (updates.gameSetup.p1Lives !== undefined) {
        const p1Lives = Number(updates.gameSetup.p1Lives);
        if (Number.isFinite(p1Lives)) {
          nextSetup.p1Lives = Math.min(3, Math.max(0, Math.floor(p1Lives)));
        }
      }
      if (updates.gameSetup.p2Lives !== undefined) {
        const p2Lives = Number(updates.gameSetup.p2Lives);
        if (Number.isFinite(p2Lives)) {
          nextSetup.p2Lives = Math.min(3, Math.max(0, Math.floor(p2Lives)));
        }
      }
      if (setupModeSet.has(updates.gameSetup.p1Mode)) {
        nextSetup.p1Mode = updates.gameSetup.p1Mode;
      }
      if (setupModeSet.has(updates.gameSetup.p2Mode)) {
        nextSetup.p2Mode = updates.gameSetup.p2Mode;
      }
      if (updates.gameSetup.p1RecommendedSide === 'left' || updates.gameSetup.p1RecommendedSide === 'right') {
        nextSetup.p1RecommendedSide = updates.gameSetup.p1RecommendedSide;
      }
      if (updates.gameSetup.p2RecommendedSide === 'left' || updates.gameSetup.p2RecommendedSide === 'right') {
        nextSetup.p2RecommendedSide = updates.gameSetup.p2RecommendedSide;
      }
      if (typeof updates.gameSetup.p1Formation === 'string' || updates.gameSetup.p1Formation === null) {
        nextSetup.p1Formation = updates.gameSetup.p1Formation;
      }
      if (typeof updates.gameSetup.p2Formation === 'string' || updates.gameSetup.p2Formation === null) {
        nextSetup.p2Formation = updates.gameSetup.p2Formation;
      }
      if (Array.isArray(updates.gameSetup.p1CustomLayout)) {
        nextSetup.p1CustomLayout = updates.gameSetup.p1CustomLayout.slice(0, 32);
      }
      if (Array.isArray(updates.gameSetup.p2CustomLayout)) {
        nextSetup.p2CustomLayout = updates.gameSetup.p2CustomLayout.slice(0, 32);
      }

      if (previousWinner === null && (nextSetup.winner === 'top' || nextSetup.winner === 'bottom')) {
        applyMatchResult(room, nextSetup.winner);
      }

      room.gameSetup = nextSetup;
    }

    if (room.isBotRoom) {
      room.p2 = getBotUserId(room.botLevel);
      room.p2_socketId = null;
      room.p2Ready = true;
      room.gameSetup = {
        ...(room.gameSetup || createDefaultGameSetup()),
        p2Ready: true,
      };
    }

    const canStartGame = !!room.p1 && !!room.p2 && !!room.p1Ready && !!room.p2Ready;
    room.status = canStartGame ? 'PLAYING' : 'WAITING';

    io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
    io.emit(SOCKET_EVENTS.ROOM_LIST, rooms);
  });

  // 7. 방 나가기 (대기실/게임 도중 나가기 버튼)
  onClientEvent(SOCKET_EVENTS.LEAVE_ROOM, ({ roomId }) => {
    socket.leave(roomId);
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM_SUCCESS);
    handleUserExitRoom(socket.id);
  });

  // 8. 방 목록 요청 (로비 진입 시)
  socket.on(SOCKET_EVENTS.REQUEST_ROOM_LIST, () => {
    socket.emit(SOCKET_EVENTS.ROOM_LIST, rooms);
  });
});

const PORT = 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 가동 중입니다!`);
});