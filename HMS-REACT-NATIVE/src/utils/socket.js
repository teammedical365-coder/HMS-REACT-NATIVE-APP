import { io } from 'socket.io-client';
import { API_BASE_URL } from './Constants';

const socket = io(API_BASE_URL, {
  autoConnect: false,
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

export default socket;