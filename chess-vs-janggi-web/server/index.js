const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Socket.io 설정 (CORS 허용: Vite 포트 5173)
// server/index.js

const io = new Server(server, {
  cors: {
    origin: "*", // 모든 오리진 허용 (개발 단계)
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true // 하위 호환성 유지
});
// --- [In-Memory Database] DB 대신 변수에 저장 ---
let connectedUsers = {}; // { socketId: { id, winRate, rank } }

let rooms = [];//roomTitle: '',roomRule: 'auto',  isPrivate: false, roomPassword: '', isState:'',    p1: null,   p2: null 

// --- [Socket Event Handlers] ---
io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // 1. 로그인 요청 처리 (유동닉 스타일)
    socket.on('login', ({ userId }) => {
        // 중복 ID 체크 (간단한 로직)
        const isExist = Object.values(connectedUsers).some(u => u.id === userId);
        
        if (isExist) {
        socket.emit('login_error', { message: '이미 접속 중인 ID입니다.' });
        } else {
        // 사용자 정보 생성 및 저장
        const userInfo = {
            id: userId,
            winRate: Math.floor(Math.random() * 100), // 랜덤 승률
            rank: Math.floor(Math.random() * 1000) + 1
        };
        
        connectedUsers[socket.id] = userInfo; // 메모리에 저장
        
        socket.emit('login_success', userInfo);
        
        // 전체 접속자 수 업데이트 방송
        io.emit('user_count', Object.keys(connectedUsers).length);
        }
    });

    // 2. 채팅 메시지 처리 (전체 방송)
    socket.on('send_message', (messageData) => {
        // 받은 메시지를 그대로 모든 클라이언트에게 뿌려줌
        io.emit('receive_message', messageData);
    });

    // 3. 연결 종료 처리
    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
        delete connectedUsers[socket.id]; // 메모리에서 삭제
        io.emit('user_count', Object.keys(connectedUsers).length);
            rooms = rooms.filter(room => {
        if (room.p1_socketId === socket.id) {
            // 방장이 나간 경우: 방 자체를 삭제 (필터링해서 제외)
            console.log(`Room ${room.id} deleted because creator left.`);
            return false; 
        }
        if (room.p2_socketId === socket.id) {
            // 참가자가 나간 경우: 방은 유지하고 p2만 비움
            room.p2 = null;
            room.p2_socketId = null;
            room.status = 'WAITING';
            return true;
        }
        return true;
        });

        // 2. 변화된 방 목록을 로비에 있는 모든 사람에게 방송!
        io.emit('room_list', rooms);
    });

     // 4. 방 생성 처리
    socket.on('create_room', (roomData) => {
        const newRoom = {
            id: `room_${Date.now()}`, // 간단한 고유 ID 생성
            title: roomData.roomTitle,
            p1: roomData.creator_id, 
            p2: null,
            status: 'WAITING'
        };
        //p1 정보가 없으면 방 생성 불가
        if (!newRoom.p1) {
            socket.emit('create_room_error', { message: '로그인이 필요합니다.' });
            return;
        }   
        
        rooms.push(newRoom);
        io.emit('room_list', rooms); // 방 목록 업데이트 방송
        socket.emit('create_room_success', newRoom);
    });
    //5. 방 나가기 처리
    socket.on('leave_room', ({ roomId, userId }) => {
        const room = rooms.find(r => r.id === roomId);
        if (room) {
            if (room.p1 === userId) {
                // 방장이 나간 경우: 방 자체를 삭제 (필터링해서 제외)
                rooms = rooms.filter(r => r.id !== roomId);
                console.log(`Room ${roomId} deleted because creator left.`);
            } else if (room.p2 === userId) {
                // 참가자가 나간 경우: 방은 유지하고 p2만 비움
                room.p2 = null;
                room.status = 'WAITING';
            }   
        }
        // 변화된 방 목록을 로비에 있는 모든 사람에게 방송!
        io.emit('room_list', rooms);
    }); 
    //6. 방 입장 처리
    socket.on('join_room', ({ room_id }) => {
        const room = rooms.find(r => r.id === room_id);
        if (room) {
            if (room.status === 'WAITING' && !room.p2) {
                room.p2 = connectedUsers[socket.id]?.id || 'Unknown';
                room.status = 'PLAYING';
                io.emit('room_list', rooms);    
                socket.emit('join_room_success', room);
            } else {
                socket.emit('join_room_error', { message: '방에 입장할 수 없습니다.' });
            }   
        } else {
            socket.emit('join_room_error', { message: '방을 찾을 수 없습니다.' });
        }   
    });
    //7. 최초 방 목록 요청 처리
    socket.on('request_room_list', () => {
        socket.emit('room_list', rooms);
    });
});

// server/index.js

const PORT = 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 가동 중입니다!`);
  console.log(`접속 가능 주소: http://localhost:${PORT} 또는 http://내-아이피:${PORT}`);
});