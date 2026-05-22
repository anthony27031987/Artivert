import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: any;
}

const log = (level: string, message: string, data?: any) => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  console.log(`[${level}] ${message}`, data || '');

  const logFile = path.join(logsDir, `${level.toLowerCase()}.log`);
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
};

export const logger = {
  info: (message: string, data?: any) => log('INFO', message, data),
  error: (message: string, data?: any) => log('ERROR', message, data),
  warn: (message: string, data?: any) => log('WARN', message, data),
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
      log('DEBUG', message, data);
    }
  },
};
