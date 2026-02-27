import React, { useState, useEffect, useRef } from 'react';
import LobbyHeader from './components/lobby/lobby-header';
import RoomList from './components/lobby/room-list';
import RoomPage from './pages/room-page';
import GameView from './pages/game-view';
import SidePanel from './components/lobby/side-panel';
// [중요] 서버 파일이 아니라, src 폴더 내의 설정 파일을 가져옵니다.
import socket from './socket';
import './App.css';

const STORAGE_KEY = 'cj-user-info';
const THEME_STORAGE_KEY = 'cj-theme-mode';

const getStoredUser = () => {
  try {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

function App() {
  // 1. 초기 상태 설정 
  const [user, setUser] = useState(() => getStoredUser());
  const [themeMode, setThemeMode] = useState(() => {
    const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
    return savedMode === 'dark' ? 'dark' : 'light';
  });

  // 방정보
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isGameViewVisible, setIsGameViewVisible] = useState(false);
  const isGameStarted = currentRoom?.status === 'PLAYING';

  // [방어적 코딩] 이벤트 리스너 내부에서 최신 State를 참조하기 위한 Ref
  // useEffect의 의존성 배열 문제로 인해 비동기 콜백 안에서 state가 옛날 값으로 남는 것을 방지합니다. 
  const userRef = useRef(user);
  const roomRef = useRef(currentRoom);

  // State가 변할 때마다 Ref도 최신화 시켜줍니다.
  useEffect(() => {
    userRef.current = user;
    roomRef.current = currentRoom;
  }, [user, currentRoom]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    let enterTimer;

    if (!currentRoom) {
      setIsGameViewVisible(false);
      return;
    }

    if (currentRoom.status === 'PLAYING') {
      enterTimer = setTimeout(() => {
        setIsGameViewVisible(true);
      }, 5000);
    } else {
      setIsGameViewVisible(false);
    }

    return () => {
      if (enterTimer) {
        clearTimeout(enterTimer);
      }
    };
  }, [currentRoom?.id, currentRoom?.status]);

  // [핵심] 소켓 이벤트 리스너 등록 (앱이 켜질 때 한 번만 실행)
  useEffect(() => {
    // 초기 소켓 연결 
    socket.connect();

    socket.on('connect', () => {
      const storedUser = getStoredUser();
      if (storedUser?.id) {
        socket.emit('login', { userId: storedUser.id });
      }
    });

    // 서버로부터 로그인 성공 응답이 오면 실행
    socket.on('login_success', (userInfo) => {
      setUser(userInfo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    });

    // 서버로부터 에러 응답이 오면 실행
    socket.on('login_error', (data) => {
      alert(data.message);
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
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

    socket.on('join_room_error', (data) => {
      alert(data.message);
    });

    socket.on('update_room_settings_error', (data) => {
      alert(data.message);
    });

    // 방 나가기 성공 시 실행
    socket.on('leave_room_success', () => {
      setCurrentRoom(null);
    });

    socket.on('room_closed', (data) => {
      setCurrentRoom(null);
      if (data?.message) {
        alert(data.message);
      }
    });

    // 방 정보 업데이트 시 실행 (예: 상대가 나갔을 때)
    socket.on('room_update', (updatedRoom) => {
      // [수정됨] 여기서 그냥 currentRoom을 쓰면 초기값(null)만 잡힙니다.
      // Ref를 통해 현재 최신 방 정보를 가져와서 비교해야 합니다.
      const current = roomRef.current;
      if (current && updatedRoom.id === current.id) {
        setCurrentRoom(updatedRoom);
      }
    });

    // 컴포넌트가 사라질 때 리스너 정리 (메모리 누수 방지)
    return () => {
      socket.off('login_success');
      socket.off('login_error');
      socket.off('connect');
      socket.off('room_list');
      socket.off('create_room_success');
      socket.off('create_room_error');
      socket.off('join_room_success');
      socket.off('join_room_error');
      socket.off('update_room_settings_error');
      socket.off('leave_room_success');
      socket.off('room_closed');
      socket.off('room_update');
    };
  }, []); // 의존성 배열 비움 (한 번만 실행)

  // 2. 로그인 요청 핸들러
  const handleLogin = (id, pw) => {
    if (!id) return;

    if (!socket.connected) {
      socket.connect();
    }

    // 서버로 '나 로그인 할래' 데이터 전송
    socket.emit('login', { userId: id.trim() });
  };

  // 3. 로그아웃 핸들러
  const handleLogout = () => {
    socket.emit('logout');
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

  const handleUpdateRoomSettings = (updates) => {
    const targetRoom = roomRef.current;
    if (!targetRoom?.id) return;

    socket.emit('update_room_settings', {
      roomId: targetRoom.id,
      updates
    });
  };

  // [수정됨] 브라우저 종료 및 뒤로가기 등 사이트 이탈 시 처리
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Ref를 사용하여 최신 값을 안전하게 가져옴
      const targetRoom = roomRef.current;
      const targetUser = userRef.current;

      // 1. 방 정보 수정 (방 나가기 처리) 요청을 먼저 보냄
      if (targetRoom && targetUser) {
        socket.emit('leave_room', { roomId: targetRoom.id, userId: targetUser.id });
      }

      // 2. 그 다음 연결을 끊음 (순서 중요)
      socket.disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Ref를 쓰므로 의존성 배열을 비워도 항상 최신값을 참조함 (리스너 재등록 방지)

  return (
    <div className="app-container">
      <LobbyHeader
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      <main className="main-content">
        {currentRoom ? (
          isGameStarted && isGameViewVisible ? (
            <section className="game-section">
              <GameView
                room={currentRoom}
                user={user}
                onLeave={handleLeaveRoom}
                onUpdateRoomSettings={handleUpdateRoomSettings}
              />
            </section>
          ) : (
            <section className="room-list-section">
              <RoomPage
                room={currentRoom}
                user={user}
                onLeave={handleLeaveRoom}
                onUpdateRoomSettings={handleUpdateRoomSettings}
              />
            </section>
          )
        ) : (
          <section className="room-list-section">
            <RoomList />
          </section>
        )}

        <aside className="side-panel-section">
          <SidePanel user={user} currentRoomId={currentRoom?.id} />
        </aside>

      </main>
    </div>
  );
}

export default App;