import { useEffect, useState } from 'react';
import { subscribeAppAlert } from '@/utils/app-alert';

// 전역 알림을 큐로 모아 모달에서 순차 표시하도록 관리합니다.
export function useAlertQueue() {
  const [alertQueue, setAlertQueue] = useState([]);

  // 전역 알림 이벤트를 구독하고, 수신 메시지를 큐 뒤에 적재합니다.
  useEffect(() => {
    const unsubscribe = subscribeAppAlert((payload) => {
      if (!payload) return;

      if (typeof payload === 'string') {
        const message = payload.trim();
        if (!message) return;
        setAlertQueue((prev) => [...prev, { kind: 'alert', message }]);
        return;
      }

      const message = String(payload.message || '').trim();
      if (!message) return;

      setAlertQueue((prev) => [
        ...prev,
        {
          kind: payload.kind === 'confirm' || payload.kind === 'choice' ? payload.kind : 'alert',
          message,
          confirmText: payload.confirmText,
          cancelText: payload.cancelText,
          choices: payload.choices,
          onConfirm: payload.onConfirm,
          onCancel: payload.onCancel,
          onChoice: payload.onChoice,
        },
      ]);
    });

    return unsubscribe;
  }, []);

  // 현재 표시한 알림 1건을 큐에서 제거합니다.
  const dequeueAlert = () => {
    setAlertQueue((prev) => prev.slice(1));
  };

  const resolveAlert = (confirmed, selectedValue = null) => {
    setAlertQueue((prev) => {
      const current = prev[0];
      if (current) {
        if (current.kind === 'choice') {
          if (confirmed) {
            current.onChoice?.(selectedValue);
          } else {
            current.onCancel?.();
          }
        } else if (confirmed) {
          current.onConfirm?.();
        } else {
          current.onCancel?.();
        }
      }
      return prev.slice(1);
    });
  };

  return {
    alertQueue,
    dequeueAlert,
    resolveAlert,
  };
}
