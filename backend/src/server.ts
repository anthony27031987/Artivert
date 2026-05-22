import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from './utils/database';
import { logger } from './utils/logger';
import apiRoutes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req: Request, res: Response, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Routes
app.use('/api/v1', apiRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'API Artivert running ✅',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne',
  });
});

// Test database connection
pool.connect(async (err, client, release) => {
  if (err) {
    logger.error('Database connection error', { error: err });
    process.exit(1);
  } else {
    logger.info('✅ Database connected successfully');
    release();
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Artivert Backend running on port ${PORT}`);
  logger.info(`📦 Database: ${process.env.DATABASE_URL}`);
  logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  logger.info(`📖 API Documentation: http://localhost:${PORT}/docs (coming soon)`);
});

export default app;
