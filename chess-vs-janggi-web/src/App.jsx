import React, { useState, useEffect } from 'react';
import LobbyHeader from './components/lobby/lobby-header';
import RoomList from './components/lobby/room-list';
import RoomPage from './pages/room-page';
import SidePanel from './components/lobby/side-panel';
// [중요] 서버 파일이 아니라, src 폴더 내의 설정 파일을 가져옵니다.
import socket from './socket';
import './App.css';

const STORAGE_KEY = 'cj-user-info';

function App() {
  // 1. 초기 상태 설정
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  // 방정보
  const [currentRoom, setCurrentRoom] = useState(null);

  // [핵심] 소켓 이벤트 리스너 등록 (앱이 켜질 때 한 번만 실행)
  useEffect(() => {
    // 초기 소켓 연결 
    socket.connect();

    // 서버로부터 로그인 성공 응답이 오면 실행
    socket.on('login_success', (userInfo) => {
      setUser(userInfo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    });

    // 서버로부터 에러 응답이 오면 실행
    socket.on('login_error', (data) => {
      alert(data.message);
      socket.disconnect(); // 실패 시 연결 끊기
    });

    // 방 생성 성공 시 실행
    socket.on('create_room_success', (newRoom) => {
      setCurrentRoom(newRoom); // 이 한 줄로 화면이 전환됩니다.
    });

    // 방 생성 실패 시 실행
    socket.on('create_room_error', (data) => {
      alert(data.message);
    });

    // 방 목록에서 입장 성공했을 때
    socket.on('join_room_success', (room) => {
      setCurrentRoom(room);
    });
    // 방 나가기 성공 시 실행
    socket.on('leave_room_success', () => {
      setCurrentRoom(null);
    });
    // 방 정보 업데이트 시 실행 (예: 상대가 나갔을 때)
    socket.on('room_update', (updatedRoom) => {
      if (currentRoom && updatedRoom.id === currentRoom.id) {
        setCurrentRoom(updatedRoom);
      }
    });

    // 컴포넌트가 사라질 때 리스너 정리 (메모리 누수 방지)
    return () => {
      socket.off('login_success');
      socket.off('login_error');
      socket.off('room_list');
      socket.off('create_room_success');
      socket.off('create_room_error');
      socket.off('join_room_success');
      socket.off('leave_room_success');
      socket.off('room_update');
    };
  }, []);

  // 2. 로그인 요청 핸들러
  const handleLogin = (id, pw) => {
    if (!id) return;

    // 서버로 '나 로그인 할래' 데이터 전송
    socket.emit('login', { userId: id });
  };
  // 3. 로그아웃 핸들러
  const handleLogout = () => {
    socket.disconnect(); // 연결 끊기
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };
  // 3. 방 나가기 핸들러
  const handleLeaveRoom = () => {
    if (currentRoom) {
      socket.emit('leave_room', { roomId: currentRoom.id, userId: user.id });
      setCurrentRoom(null); // 다시 로비로 이동
    }
  };
  // 브라우저 종료밑 뒤로가기등등 사이트 이탈시 소켓 연결 끊기
  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  return (
    <div className="app-container">
      <LobbyHeader user={user} onLogin={handleLogin} onLogout={handleLogout} />

      <main className="main-content">

        <>
          {currentRoom ? (
            /* [A] 게임 대기실 뷰 (방 안에 있을 때) */
            <section className="room-list-section">
              <RoomPage room={currentRoom} user={user} onLeave={handleLeaveRoom} />
            </section>
          ) : (
            /* [B] 로비 뷰 (방 밖에 있을 때) */
            <section className="room-list-section">
              <RoomList />
            </section>
          )}
          <aside className="side-panel-section">
            <SidePanel user={user} />
          </aside>
        </>

      </main>
    </div>
  );
}

export default App;