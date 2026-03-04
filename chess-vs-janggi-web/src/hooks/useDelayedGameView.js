import { useEffect, useState } from 'react';

// 게임 시작 상태에서 게임 화면 진입을 잠시 지연해 연출을 맞춥니다.
export function useDelayedGameView(currentRoom) {
  const [isGameViewVisible, setIsGameViewVisible] = useState(false);

  // 방 상태가 PLAYING이면 5초 후 게임 화면을 노출하고, 그 외에는 즉시 숨깁니다.
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

  return isGameViewVisible;
}
