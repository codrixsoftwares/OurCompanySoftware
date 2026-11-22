import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { connectMongo, syncMongoDatabase } from './core/mongodb.js';
import { MigrationRunner } from './core/migrations/migrationRunner.js';
import { authMiddleware } from './core/auth/middleware.js';
import { SocketService } from './core/socket/socketService.js';
import authRoutes from './modules/auth/authRoutes.js';
import recruitmentRoutes from './modules/recruitment/recruitmentRoutes.js';
import mailboxRoutes from './modules/mailbox/mailboxRoutes.js';
import crmRoutes from './modules/crm/crmRoutes.js';
import engineeringRoutes from './modules/engineering/engineeringRoutes.js';
import hrmsRoutes from './modules/hrms/hrmsRoutes.js';
import reportsRoutes from './modules/reports/reportsRoutes.js';
import settingsRoutes from './modules/settings/settingsRoutes.js';
import publicRoutes from './modules/public/publicRoutes.js';
import projectsRoutes from './modules/projects/projectsRoutes.js';
import emailTemplateRoutes from './modules/templates/templateRoutes.js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '15mb' }));

// Attach active session / tenant context
app.use(authMiddleware);

// Health check
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: 'MongoDB Atlas (codrix)',
    storage: 'Cloudinary',
    timestamp: new Date().toISOString(),
    service: 'CodRix Enterprise Operating System API v1'
  });
});

// Domain Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/recruitment', recruitmentRoutes);
app.use('/api/v1/mailboxes', mailboxRoutes);
app.use('/api/v1/crm', crmRoutes);
app.use('/api/v1/engineering', engineeringRoutes);
app.use('/api/v1/hrms', hrmsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/email-templates', emailTemplateRoutes);
app.use('/api/v1/public', publicRoutes);

// Single Server Deployment: Serve Compiled Frontend (client/dist)
const clientDistPath = fs.existsSync(path.resolve(process.cwd(), 'client/dist'))
  ? path.resolve(process.cwd(), 'client/dist')
  : fs.existsSync(path.resolve(process.cwd(), '../client/dist'))
  ? path.resolve(process.cwd(), '../client/dist')
  : path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler conforming to CDX-API-001
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
      request_id: req.auth?.requestId || `req_${Date.now()}`
    }
  });
});

export const server = http.createServer(app);
SocketService.init(server);

async function start() {
  if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
      console.log(`🚀 CodRix API running on http://localhost:${PORT}/api/v1 (with Socket.IO active)`);
    });
  }

  try {
    const db = await connectMongo();
    await syncMongoDatabase();
    MigrationRunner.runPending(db).catch((e) => console.warn('Background migration notice:', e?.message || e));
  } catch (error) {
    console.error('Fatal database startup error:', error);
  }
}

start();
