import { showAppAlert } from '@/utils/app-alert';
import { validateSocketPayload } from './socket-contract';

export function emitSocketEvent(socket, eventName, payload, options = {}) {
  const { silent = false, invalidMessage = '요청 형식이 올바르지 않습니다.' } = options;

  if (!validateSocketPayload(eventName, payload)) {
    if (!silent) {
      showAppAlert(invalidMessage);
    }
    return false;
  }

  socket.emit(eventName, payload);
  return true;
}
