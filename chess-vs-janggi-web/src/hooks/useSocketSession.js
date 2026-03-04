import { useEffect } from 'react';
import socket from '@/socket';
import { getStoredUser } from '@/hooks/useStoredUser';
import { emitSocketEvent } from '@/socket/socket-emit';
import { attachSocketAlertCenter } from '@/socket/socket-alert-center';
import { SOCKET_EVENTS, validateSocketPayload } from '@/socket/socket-contract';

export function useSocketSession({ persistUser, setCurrentRoom, setForfeitResult, userRef, roomRef, forceLogoutToMain }) {
  useEffect(() => {
    socket.connect();

    const detachAlertCenter = attachSocketAlertCenter({
      socket,
      forceLogoutToMain,
      setCurrentRoom,
    });

    socket.on(SOCKET_EVENTS.CONNECT, () => {
      const storedUser = getStoredUser();
      if (storedUser?.id) {
        emitSocketEvent(socket, SOCKET_EVENTS.LOGIN, { userId: storedUser.id }, { silent: true });
      }
    });

    socket.on(SOCKET_EVENTS.LOGIN_SUCCESS, (userInfo) => {
      if (!validateSocketPayload(SOCKET_EVENTS.LOGIN_SUCCESS, userInfo)) return;
      persistUser(userInfo);
    });

    socket.on(SOCKET_EVENTS.USER_PROFILE_UPDATED, (profile) => {
      if (!validateSocketPayload(SOCKET_EVENTS.USER_PROFILE_UPDATED, profile)) return;
      if (!profile?.id) return;

      persistUser((prev) => {
        if (!prev || prev.id !== profile.id) return prev;
        return { ...prev, ...profile };
      });
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      if (!userRef.current) return;
      forceLogoutToMain(`세션 연결이 끊어졌습니다. (${reason})\n메인 화면으로 이동합니다.`);
    });

    socket.on(SOCKET_EVENTS.CREATE_ROOM_SUCCESS, (newRoom) => {
      if (!validateSocketPayload(SOCKET_EVENTS.CREATE_ROOM_SUCCESS, newRoom)) return;
      setCurrentRoom(newRoom);
    });

    socket.on(SOCKET_EVENTS.JOIN_ROOM_SUCCESS, (room) => {
      if (!validateSocketPayload(SOCKET_EVENTS.JOIN_ROOM_SUCCESS, room)) return;
      setCurrentRoom(room);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM_SUCCESS, () => {
      setCurrentRoom(null);
    });

    socket.on(SOCKET_EVENTS.ROOM_UPDATE, (updatedRoom) => {
      if (!validateSocketPayload(SOCKET_EVENTS.ROOM_UPDATE, updatedRoom)) return;
      const current = roomRef.current;
      if (current && updatedRoom.id === current.id) {
        setCurrentRoom(updatedRoom);
      }
    });

    socket.on(SOCKET_EVENTS.FORFEIT_RESULT, (payload) => {
      if (!validateSocketPayload(SOCKET_EVENTS.FORFEIT_RESULT, payload)) return;
      if (!payload?.winnerId || !payload?.loserId) return;
      setForfeitResult(payload);
      window.setTimeout(() => {
        setForfeitResult((prev) => (prev === payload ? null : prev));
      }, 2200);
    });

    return () => {
      detachAlertCenter();
      socket.off(SOCKET_EVENTS.LOGIN_SUCCESS);
      socket.off(SOCKET_EVENTS.USER_PROFILE_UPDATED);
      socket.off(SOCKET_EVENTS.CONNECT);
      socket.off(SOCKET_EVENTS.ROOM_LIST);
      socket.off(SOCKET_EVENTS.CREATE_ROOM_SUCCESS);
      socket.off(SOCKET_EVENTS.JOIN_ROOM_SUCCESS);
      socket.off(SOCKET_EVENTS.LEAVE_ROOM_SUCCESS);
      socket.off(SOCKET_EVENTS.ROOM_UPDATE);
      socket.off(SOCKET_EVENTS.FORFEIT_RESULT);
      socket.off(SOCKET_EVENTS.DISCONNECT);
    };
  }, [persistUser, forceLogoutToMain, roomRef, setCurrentRoom, setForfeitResult, userRef]);
}