const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

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
let rooms = []; 
// Room 구조: { id, title, p1, p1_socketId, p2, p2_socketId, status }

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

/**
 * [Helper] 유저가 방에서 나갈 때의 공통 처리 로직
 * - 방장(P1)이 나가면 방이 폭파됨.
 * - 참가자(P2)가 나가면 방은 유지되고 P2 자리가 빔.
 */
const handleUserExitRoom = (socketId) => {
  let isRoomListChanged = false;

  // filter를 사용하여 방 목록을 갱신 (방장이 나간 방은 제외)
  rooms = rooms.filter(room => {
    // 1. 방장(P1)이 나가는 경우 -> 방 삭제
    if (room.p1_socketId === socketId) {
      console.log(`[Room Deleted] Creator left: ${room.id}`);
      io.to(room.id).emit('room_closed', {
        roomId: room.id,
        message: '방장이 방을 떠나 로비로 이동합니다.'
      });
      io.in(room.id).socketsLeave(room.id);
      isRoomListChanged = true;
      return false; // 목록에서 제외
    }

    // 2. 참가자(P2)가 나가는 경우 -> 방 유지, P2 정보 초기화
    if (room.p2_socketId === socketId) {
      console.log(`[Player Left] P2 left room: ${room.id}`);
      room.p2 = null;
      room.p2_socketId = null;
      room.status = 'WAITING'; // 다시 대기 상태로 변경
      room.p2Faction = 'janggi';
      room.p1Ready = false;
      room.p2Ready = false;
      
      // 해당 방에 있는 사람들에게 알림 (선택 사항)
      io.to(room.id).emit('receive_room_message', {
        sender: 'System',
        message: '상대방이 나갔습니다.'
      });
      io.to(room.id).emit('room_update', room);
      
      isRoomListChanged = true;
      return true; // 목록 유지
    }

    return true; // 관련 없는 방은 유지
  });

  // 변경사항이 있으면 로비에 있는 모든 사람에게 방 목록 방송
  if (isRoomListChanged) {
    io.emit('room_list', rooms);
  }
};


// --- [Socket Event Handlers] ---
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. 로그인 요청
  socket.on('login', ({ userId }) => {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

    if (!normalizedUserId) {
      socket.emit('login_error', { message: '유효한 ID를 입력해주세요.' });
      return;
    }

    // 이미 접속 중인 ID 처리
    const existingSocketId = userToSocketId[normalizedUserId];
    if (existingSocketId && existingSocketId !== socket.id) {
        // 실제 연결이 살아있는지 확인
        if (io.sockets.sockets.has(existingSocketId)) {
            socket.emit('login_error', { message: '이미 접속 중인 ID입니다.' });
            return;
        }
        delete userToSocketId[normalizedUserId];
    }

    // 사용자 정보 생성 및 저장
    const userInfo = {
      id: normalizedUserId,
      winRate: Math.floor(Math.random() * 100),
      rank: Math.floor(Math.random() * 1000) + 1
    };

    connectedUsers[socket.id] = userInfo;
    userToSocketId[normalizedUserId] = socket.id;

    socket.emit('login_success', userInfo);
    io.emit('user_count', Object.keys(connectedUsers).length);
  });

  // 2. 로비 채팅
  socket.on('send_message', (messageData) => {
    io.emit('receive_message', messageData);
  });

  // 2-2. 인게임/대기실 채팅
  socket.on('send_room_message', ({ roomId, messageData }) => {
    if (roomId && io.sockets.adapter.rooms.has(roomId)) {
       io.to(roomId).emit('receive_room_message', messageData);
    }
  });

  // 3. 연결 종료 (브라우저 닫음 등)
  socket.on('disconnect', () => {
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
    io.emit('user_count', Object.keys(connectedUsers).length);
  });

  // 4. 로그아웃 (버튼 클릭)
  socket.on('logout', () => {
    const currentUser = connectedUsers[socket.id];
    if (currentUser) {
        delete userToSocketId[currentUser.id];
        delete connectedUsers[socket.id];
    }
    
    // 방 처리 로직 실행 (중복 제거됨)
    handleUserExitRoom(socket.id);

    io.emit('user_count', Object.keys(connectedUsers).length);
  });

  // 5. 방 만들기
  socket.on('create_room', (roomData) => {
    const currentUser = connectedUsers[socket.id];
    if (!currentUser) {
      socket.emit('create_room_error', { message: '로그인이 필요합니다.' });
      return;
    }
    
    const newRoom = {
      id: `room_${Date.now()}`,
      title: roomData.roomTitle || `${currentUser.id}님의 게임`, // 제목 없을 시 기본값
      p1: currentUser.id,
      p1_socketId: socket.id,
      p2: null,
      p2_socketId: null,
      status: 'WAITING',
      roomRule: normalizeRoomRule(roomData.roomRule),
      roomMap: roomData.roomMap || '체스판',
      p1Faction: roomData.p1Faction || 'chess',
      p2Faction: roomData.p2Faction || 'janggi',
      p1Ready: false,
      p2Ready: false
    };

    rooms.push(newRoom);
    socket.join(newRoom.id);
    
    io.emit('room_list', rooms);
    socket.emit('create_room_success', newRoom);
  });

  // 6. 방 입장
  socket.on('join_room', ({ roomId }) => { // 변수명 roomId로 통일
    const currentUser = connectedUsers[socket.id];
    if (!currentUser) {
      socket.emit('join_room_error', { message: '로그인이 필요합니다.' });
      return;
    }

    const room = rooms.find(r => r.id === roomId);
    
    if (!room) {
      socket.emit('join_room_error', { message: '존재하지 않는 방입니다.' });
      return;
    }

    if (room.status === 'WAITING' && !room.p2) {
      room.p2 = currentUser.id;
      room.p2_socketId = socket.id;
      room.status = 'WAITING';
      room.p1Ready = false;
      room.p2Ready = false;
      
      socket.join(room.id);
      
      io.emit('room_list', rooms); // 로비 갱신
      socket.emit('join_room_success', room); // 본인에게 알림
      io.to(room.id).emit('room_update', room); // 방 참가자(P1/P2) 상세 정보 갱신
      
      // 방에 있는 P1에게도 알림 (게임 시작 신호 등)
      io.to(room.id).emit('player_joined', { p2: currentUser.id });
      
    } else {
      socket.emit('join_room_error', { message: '방이 꽉 찼거나 게임 중입니다.' });
    }
  });

  socket.on('update_room_settings', ({ roomId, updates }) => {
    const currentUser = connectedUsers[socket.id];
    if (!currentUser) {
      socket.emit('update_room_settings_error', { message: '로그인이 필요합니다.' });
      return;
    }

    const room = rooms.find(r => r.id === roomId);
    if (!room) {
      socket.emit('update_room_settings_error', { message: '존재하지 않는 방입니다.' });
      return;
    }

    const isParticipant = room.p1_socketId === socket.id || room.p2_socketId === socket.id;
    if (!isParticipant) {
      socket.emit('update_room_settings_error', { message: '방 참가자만 설정을 변경할 수 있습니다.' });
      return;
    }

    const allowedRules = new Set(['자율선택', '랜덤배정', '방장선택']);
    const allowedMaps = new Set(['체스판', '장기판', '바둑판']);
    const allowedFactions = new Set(['chess', 'janggi', 'omok']);

    if (typeof updates !== 'object' || !updates) {
      socket.emit('update_room_settings_error', { message: '잘못된 설정 요청입니다.' });
      return;
    }

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
      room.p2Ready = false;
    }

    if (updates.p2Faction && allowedFactions.has(updates.p2Faction)) {
      room.p2Faction = updates.p2Faction;
      room.p1Ready = false;
      room.p2Ready = false;
    }
    if (updates.p2Ready !== undefined) {
      room.p2Ready = !!updates.p2Ready;
    }
    if (updates.p1Ready !== undefined) {
      room.p1Ready = !!updates.p1Ready;
    }

    const canStartGame = !!room.p1 && !!room.p2 && !!room.p1Ready && !!room.p2Ready;
    room.status = canStartGame ? 'PLAYING' : 'WAITING';

    io.to(room.id).emit('room_update', room);
    io.emit('room_list', rooms);
  });

  // 7. 방 나가기 (대기실/게임 도중 나가기 버튼)
  socket.on('leave_room', ({ roomId }) => {
    socket.leave(roomId);
    handleUserExitRoom(socket.id);
  });

  // 8. 방 목록 요청 (로비 진입 시)
  socket.on('request_room_list', () => {
    socket.emit('room_list', rooms);
  });
});

const PORT = 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 가동 중입니다!`);
});