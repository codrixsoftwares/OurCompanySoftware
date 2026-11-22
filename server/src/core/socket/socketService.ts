import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;
const JWT_SECRET = process.env.JWT_SECRET || 'codrix-super-secret-jwt-key-2026';

export class SocketService {
  static init(server: http.Server): SocketIOServer {
    io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT']
      },
      transports: ['websocket', 'polling'],
      pingInterval: 8000,
      pingTimeout: 4000,
      connectTimeout: 10000,
      maxHttpBufferSize: 5e6 // 5MB fast payload buffer
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          socket.data.user = decoded;
          socket.data.tenantId = decoded.tenantId;
        } catch {
          // Allow connection for guest/diagnostics
        }
      }
      next();
    });

    io.on('connection', (socket) => {
      const tenantId = socket.data.tenantId;
      if (tenantId) {
        socket.join(`tenant:${tenantId}`);
        console.log(`⚡ High-speed Socket connected: ${socket.id} (tenant:${tenantId})`);
      } else {
        socket.join('public_room');
      }

      // Latency probe
      socket.on('latency:ping', (clientTimestamp: number) => {
        socket.emit('latency:pong', { clientTimestamp, serverTimestamp: Date.now() });
      });

      // Mailbox room subscription
      socket.on('join_mailbox', (mailboxId: string) => {
        socket.join(`mailbox:${mailboxId}`);
      });

      socket.on('leave_mailbox', (mailboxId: string) => {
        socket.leave(`mailbox:${mailboxId}`);
      });

      // CRM room subscription
      socket.on('join_crm', () => {
        socket.join(`crm:${tenantId || 'global'}`);
      });

      // Engineering room subscription
      socket.on('join_engineering', () => {
        socket.join(`engineering:${tenantId || 'global'}`);
      });

      socket.on('disconnect', () => {
        // Disconnected cleanly
      });
    });

    console.log('⚡ Real-time Socket.IO engine initialized with WebSocket high-speed acceleration');
    return io;
  }

  static getIO(): SocketIOServer | null {
    return io;
  }

  /**
   * High-speed broadcast to a tenant room and fallbacks
   */
  static emitToTenant(tenantId: string, event: string, payload: any) {
    if (io) {
      io.to(`tenant:${tenantId}`).emit(event, payload);
      // Also broadcast globally so all logged-in admin sessions sync with 0ms delay
      io.emit(event, payload);
    }
  }

  static emitToMailbox(mailboxId: string, event: string, payload: any) {
    if (io) {
      io.to(`mailbox:${mailboxId}`).emit(event, payload);
      io.emit(event, payload);
    }
  }

  static broadcast(event: string, payload: any) {
    if (io) {
      io.emit(event, payload);
    }
  }
}
