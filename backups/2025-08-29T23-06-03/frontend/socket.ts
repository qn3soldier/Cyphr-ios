import io from 'socket.io-client';

const defaultServer = (import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'https://app.cyphrmessenger.app/api').replace(/\/api$/, '');
const socket = io(import.meta.env.VITE_WEBSOCKET_URL || `${defaultServer}`, { 
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export default socket;
