import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentLatency: number = 0;
const statusListeners = new Set<(connected: boolean, latency: number) => void>();

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token') || '';
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;

    socket = io(socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 3000,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('⚡ High-Speed Socket.IO connected live to CodRix real-time event bus:', socket?.id);
      measureLatency();
      statusListeners.forEach((fn) => fn(true, currentLatency));
    });

    socket.on('disconnect', () => {
      console.log('⚡ Socket.IO disconnected. Auto-reconnecting in background...');
      statusListeners.forEach((fn) => fn(false, currentLatency));
    });

    socket.on('connect_error', () => {
      statusListeners.forEach((fn) => fn(false, currentLatency));
    });

    socket.on('latency:pong', ({ clientTimestamp }: { clientTimestamp: number }) => {
      currentLatency = Math.max(1, Date.now() - clientTimestamp);
      statusListeners.forEach((fn) => fn(socket?.connected || false, currentLatency));
    });

    // Periodic heartbeat latency probe
    setInterval(() => {
      if (socket?.connected) {
        measureLatency();
      }
    }, 15000);
  } else {
    // If token in localStorage changed, update auth token dynamically
    const token = localStorage.getItem('token') || '';
    if (socket.auth && typeof socket.auth === 'object') {
      (socket.auth as any).token = token;
    }
  }

  return socket;
}

export function measureLatency() {
  if (socket?.connected) {
    socket.emit('latency:ping', Date.now());
  }
}

export function onSocketStatusChange(callback: (connected: boolean, latency: number) => void): () => void {
  statusListeners.add(callback);
  // Initial immediate notification
  callback(socket?.connected || false, currentLatency);
  return () => {
    statusListeners.delete(callback);
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
