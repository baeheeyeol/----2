import React, { useCallback, useEffect, useRef, useState } from 'react';
import LobbyHeader from '@/components/lobby/lobby-header';
import RoomList from '@/components/lobby/room-list';
import RoomPage from '@/pages/room-page';
import GameView from '@/pages/game-view';
import SidePanel from '@/components/lobby/side-panel';
import MobileLobbyDrawer from '@/components/lobby/mobile-lobby-drawer';
import AppAlertModal from '@/components/shared/app-alert-modal';
import { showAppAlert } from '@/utils/app-alert';
import { useStoredUser, getStoredUser, STORAGE_KEY } from '@/hooks/useStoredUser';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useAlertQueue } from '@/hooks/useAlertQueue';
import { useDelayedGameView } from '@/hooks/useDelayedGameView';
import { useSocketSession } from '@/hooks/useSocketSession';
import { emitSocketEvent } from '@/socket/socket-emit';
import { SOCKET_EVENTS } from '@/socket/socket-contract';
// [중요] 서버 파일이 아니라, src 폴더 내의 설정 파일을 가져옵니다.
import socket from '@/socket';
import '@/App.css';

function App() {
  // 1. 초기 상태 설정
  const { user, persistUser, clearUser } = useStoredUser();
  const { themeMode, toggleTheme } = useThemeMode();
  const { alertQueue, dequeueAlert, resolveAlert } = useAlertQueue();

  // 방정보
  const [currentRoom, setCurrentRoom] = useState(null);
  const isGameViewVisible = useDelayedGameView(currentRoom);
  const [forfeitResult, setForfeitResult] = useState(null);
  const isGameStarted = currentRoom?.status === 'PLAYING';

  // [방어적 코딩] 이벤트 리스너 내부에서 최신 State를 참조하기 위한 Ref
  // useEffect의 의존성 배열 문제로 인해 비동기 콜백 안에서 state가 옛날 값으로 남는 것을 방지합니다. 
  const userRef = useRef(user);
  const roomRef = useRef(currentRoom);
  const sessionAlertLockRef = useRef(false);

  // State가 변할 때마다 Ref도 최신화 시켜줍니다.
  useEffect(() => {
    userRef.current = user;
    roomRef.current = currentRoom;
  }, [user, currentRoom]);

  useEffect(() => {
    if (user) {
      sessionAlertLockRef.current = false;
    }
  }, [user]);

  const forceLogoutToMain = useCallback((message) => {
    if (sessionAlertLockRef.current) return;
    sessionAlertLockRef.current = true;

    setCurrentRoom(null);
    clearUser();

    if (message) {
      showAppAlert(message);
    }
  }, [clearUser]);

  const { connectionNotice } = useSocketSession({
    persistUser,
    setCurrentRoom,
    setForfeitResult,
    userRef,
    roomRef,
    forceLogoutToMain,
  });

  useEffect(() => {
    const verifyStoredSession = () => {
      if (!userRef.current) return;

      const storedUser = getStoredUser();
      if (!storedUser?.id) {
        forceLogoutToMain('로컬 캐시 정보가 사라져 자동 로그아웃되었습니다. 다시 로그인해주세요.');
      }
    };

    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      if (userRef.current && !event.newValue) {
        forceLogoutToMain('캐시 정보 변경이 감지되어 로그아웃되었습니다. 다시 로그인해주세요.');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifyStoredSession();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', verifyStoredSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', verifyStoredSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 2. 로그인 요청 핸들러
  const handleLogin = (id) => {
    if (!id) return;

    if (!socket.connected) {
      socket.connect();
    }

    // 서버로 '나 로그인 할래' 데이터 전송
    emitSocketEvent(socket, SOCKET_EVENTS.LOGIN, { userId: id.trim() });
  };

  // 3. 로그아웃 핸들러
  const handleLogout = () => {
    socket.emit(SOCKET_EVENTS.LOGOUT);
    clearUser();
  };

  // 3. 방 나가기 핸들러
  const handleLeaveRoom = () => {
    if (currentRoom) {
      emitSocketEvent(socket, SOCKET_EVENTS.LEAVE_ROOM, { roomId: currentRoom.id, userId: user.id }, { silent: true });
      setCurrentRoom(null); // 다시 로비로 이동
    }
  };

  const handleUpdateRoomSettings = (updates) => {
    const targetRoom = roomRef.current;
    if (!targetRoom?.id) return;

    emitSocketEvent(socket, SOCKET_EVENTS.UPDATE_ROOM_SETTINGS, {
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
        emitSocketEvent(socket, SOCKET_EVENTS.LEAVE_ROOM, { roomId: targetRoom.id, userId: targetUser.id }, { silent: true });
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
    <div className={`app-container ${user && currentRoom ? 'mobile-header-hidden' : ''}`}>
      <LobbyHeader
        // 로그인한 사용자 정보(없으면 비로그인 UI)
        user={user}
        // 로그인 요청 콜백(id 전달)
        onLogin={handleLogin}
        // 로그아웃 처리 콜백
        onLogout={handleLogout}
        // 현재 테마 모드(light/dark)
        themeMode={themeMode}
        // 테마 토글 핸들러
        onToggleTheme={toggleTheme}
      />

      <main className="main-content">
        {connectionNotice && (
          <div className="socket-connection-banner" role="status" aria-live="polite">
            {connectionNotice}
          </div>
        )}

        {currentRoom ? (
          isGameStarted && isGameViewVisible ? (
            <section className="game-section">
              <GameView
                // 현재 입장한 방 메타/설정 정보
                room={currentRoom}
                // 현재 사용자 정보
                user={user}
                // 게임/방에서 나가기 콜백
                onLeave={handleLeaveRoom}
                // 방 옵션 변경 요청 콜백
                onUpdateRoomSettings={handleUpdateRoomSettings}
              />
            </section>
          ) : (
            <section className="room-list-section">
              <RoomPage
                // 현재 입장한 방 메타/설정 정보
                room={currentRoom}
                // 현재 사용자 정보
                user={user}
                // 방 나가기 콜백
                onLeave={handleLeaveRoom}
                // 방 옵션 변경 요청 콜백
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
          {/* user: 사용자 정보, currentRoomId: 현재 방 ID(없으면 undefined) */}
          <SidePanel user={user} currentRoomId={currentRoom?.id} />
        </aside>

      </main>

      {/* user: 사용자 정보, currentRoomId: 현재 방 ID, onLogout: 로그아웃 콜백 */}
      <MobileLobbyDrawer user={user} currentRoomId={currentRoom?.id} onLogout={handleLogout} />

      {forfeitResult && (
        <div className="forfeit-result-overlay" role="dialog" aria-modal="true" aria-live="polite">
          <div className="forfeit-result-modal">
            <div className="forfeit-result-title">경기 종료</div>
            <div className="forfeit-result-body">
              {user?.id === forfeitResult.winnerId ? '기권승' : user?.id === forfeitResult.loserId ? '기권패' : '기권 결과'}
            </div>
          </div>
        </div>
      )}

      <AppAlertModal
        // 모달 오픈 여부(알림 큐에 데이터가 있으면 true)
        isOpen={alertQueue.length > 0}
        // 현재 표시할 알림 메시지(큐의 첫 항목)
        message={alertQueue[0]?.message || ''}
        mode={alertQueue[0]?.kind || 'alert'}
        confirmText={alertQueue[0]?.confirmText || '확인'}
        cancelText={alertQueue[0]?.cancelText || '취소'}
        choices={alertQueue[0]?.choices || []}
        // 확인 버튼 클릭 시 큐에서 한 건 제거
        onClose={dequeueAlert}
        onConfirm={() => resolveAlert(true)}
        onCancel={() => resolveAlert(false)}
        onChoice={(value) => resolveAlert(true, value)}
      />
    </div>
  );
}

export default App;