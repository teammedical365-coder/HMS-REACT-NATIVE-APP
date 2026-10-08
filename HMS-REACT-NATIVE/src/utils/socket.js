import { io } from 'socket.io-client';
import { SOCKET_URL } from './Constants';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

let currentUser = null;
let hasAttachedConnectHandler = false;

const performRoomJoins = (user) => {
  if (!socket.connected || !user) return;

  const hospitalId = user.hospitalId || (typeof user.hospital === 'object' ? user.hospital?._id : user.hospital);
  if (hospitalId) {
    socket.emit('joinHospitalRoom', hospitalId);
    socket.emit('join', String(hospitalId));
    socket.emit('join', `hospital_${hospitalId}`);
  }

  const rawRole = typeof user.role === 'object' ? user.role?.name : user.role;
  const role = (rawRole || '').toLowerCase().replace(/\s+/g, '');
  if (role) {
    socket.emit('join', role);
  }

  // Join 'ot manager' for all OT staff, surgeons, doctors and admins
  if (['otmanager', 'otstaff', 'doctor', 'clinicdoctor', 'hospitaladmin', 'superadmin', 'centraladmin', 'admin'].includes(role)) {
    socket.emit('join', 'ot manager');
  }

  if (user._id) {
    socket.emit('join', String(user._id));
  }
};

export const connectAuthenticatedSocket = (user) => {
  currentUser = user;

  if (!hasAttachedConnectHandler) {
    hasAttachedConnectHandler = true;
    socket.on('connect', () => {
      if (currentUser) {
        performRoomJoins(currentUser);
      }
    });
  }

  if (!socket.connected) {
    socket.connect();
  } else if (currentUser) {
    performRoomJoins(currentUser);
  }
};

export const disconnectSocket = () => {
  currentUser = null;
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;