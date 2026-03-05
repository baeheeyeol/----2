import { useCallback, useEffect, useRef, useState } from 'react';
import socket from '@/socket';
import { SOCKET_EVENTS, validateSocketPayload } from '@/socket/socket-contract';

export function useRoomList() {
  const [rooms, setRooms] = useState([]);
  const roomsRef = useRef([]);

  const applyRoomList = useCallback((updatedRooms) => {
    const nextRooms = Array.isArray(updatedRooms) ? updatedRooms : [];
    roomsRef.current = nextRooms;
    setRooms(nextRooms);
    return nextRooms;
  }, []);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    socket.emit(SOCKET_EVENTS.REQUEST_ROOM_LIST);

    const handleRoomList = (updatedRooms) => {
      if (!validateSocketPayload(SOCKET_EVENTS.ROOM_LIST, updatedRooms)) return;
      applyRoomList(updatedRooms);
    };

    socket.on(SOCKET_EVENTS.ROOM_LIST, handleRoomList);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_LIST, handleRoomList);
    };
  }, [applyRoomList]);

  const requestLatestRoomList = useCallback(
    (timeoutMs = 300) => {
      return new Promise((resolve) => {
        let handled = false;

        const handleDone = (nextRooms) => {
          if (handled) return;
          handled = true;
          socket.off(SOCKET_EVENTS.ROOM_LIST, handleRoomListOnce);
          resolve(nextRooms);
        };

        const handleRoomListOnce = (updatedRooms) => {
          if (!validateSocketPayload(SOCKET_EVENTS.ROOM_LIST, updatedRooms)) {
            handleDone(roomsRef.current);
            return;
          }

          handleDone(applyRoomList(updatedRooms));
        };

        socket.once(SOCKET_EVENTS.ROOM_LIST, handleRoomListOnce);
        socket.emit(SOCKET_EVENTS.REQUEST_ROOM_LIST);

        window.setTimeout(() => {
          handleDone(roomsRef.current);
        }, timeoutMs);
      });
    },
    [applyRoomList],
  );

  return {
    rooms,
    requestLatestRoomList,
  };
}
