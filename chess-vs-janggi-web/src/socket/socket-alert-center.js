import { showAppAlert } from '@/utils/app-alert';
import { getSocketErrorMessage, SOCKET_EVENTS } from './socket-contract';

export function attachSocketAlertCenter({ socket, forceLogoutToMain, setCurrentRoom }) {
  const handleAuthError = (payload) => {
    forceLogoutToMain?.(getSocketErrorMessage(payload, '세션이 만료되었습니다. 다시 로그인해주세요.'));
  };

  const handleRoomActionError = (payload) => {
    showAppAlert(getSocketErrorMessage(payload));
  };

  const handleGenericSocketError = (payload) => {
    showAppAlert(getSocketErrorMessage(payload));
  };

  const handleRoomClosed = (payload) => {
    setCurrentRoom?.(null);
    const message = getSocketErrorMessage(payload, '방이 종료되어 로비로 이동합니다.');
    showAppAlert(message);
  };

  socket.on(SOCKET_EVENTS.LOGIN_ERROR, handleAuthError);
  socket.on(SOCKET_EVENTS.CREATE_ROOM_ERROR, handleRoomActionError);
  socket.on(SOCKET_EVENTS.JOIN_ROOM_ERROR, handleRoomActionError);
  socket.on(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS_ERROR, handleRoomActionError);
  socket.on(SOCKET_EVENTS.SOCKET_ERROR, handleGenericSocketError);
  socket.on(SOCKET_EVENTS.ROOM_CLOSED, handleRoomClosed);

  return () => {
    socket.off(SOCKET_EVENTS.LOGIN_ERROR, handleAuthError);
    socket.off(SOCKET_EVENTS.CREATE_ROOM_ERROR, handleRoomActionError);
    socket.off(SOCKET_EVENTS.JOIN_ROOM_ERROR, handleRoomActionError);
    socket.off(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS_ERROR, handleRoomActionError);
    socket.off(SOCKET_EVENTS.SOCKET_ERROR, handleGenericSocketError);
    socket.off(SOCKET_EVENTS.ROOM_CLOSED, handleRoomClosed);
  };
}
