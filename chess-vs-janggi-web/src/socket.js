// ...existing code...
import io from 'socket.io-client';

const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const defaultSocketUrl = isLocalHost
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : window.location.origin;
const socketUrl = import.meta.env.VITE_SOCKET_URL?.trim() || defaultSocketUrl;

const resolveHealthUrl = () => {
  try {
    const parsedUrl = new URL(socketUrl, window.location.origin);
    return `${parsedUrl.origin}/health`;
  } catch {
    return '/health';
  }
};

export const socketHealthUrl = resolveHealthUrl();

const socket = io(socketUrl, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  randomizationFactor: 0.5,
  timeout: 20000,
});

export default socket;
// ...existing code...