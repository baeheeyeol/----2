// ...existing code...
import io from 'socket.io-client';

const host = window.location.hostname;

const socket = io(`http://${host}:3001`, {
  autoConnect: false,
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 5,
  timeout: 10000,
});

export default socket;
// ...existing code...