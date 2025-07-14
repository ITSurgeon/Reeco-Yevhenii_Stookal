import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import syscoConfig from '../config/sysco-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom format for logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Format for console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Transport configuration
const transports = [
  // Console output
  new winston.transports.Console({
    format: consoleFormat
  }),

  // File for all logs
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: syscoConfig.logging.maxSize,
    maxFiles: syscoConfig.logging.maxFiles,
    format: customFormat
  }),

  // Separate file for errors
  new DailyRotateFile({
    filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: syscoConfig.logging.maxSize,
    maxFiles: syscoConfig.logging.maxFiles,
    level: 'error',
    format: customFormat
  })
];

// Logger creation
const logger = winston.createLogger({
  level: syscoConfig.logging.level,
  format: customFormat,
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD'
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../../logs/rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD'
    })
  ]
});

// Additional convenience methods
logger.scrapeInfo = (message, meta = {}) => {
  logger.info(`[SCRAPE] ${message}`, meta);
};

logger.scrapeError = (message, error = {}) => {
  logger.error(`[SCRAPE] ${message}`, { error: error.message, stack: error.stack });
};

logger.performance = (message, startTime) => {
  const duration = Date.now() - startTime;
  logger.info(`[PERFORMANCE] ${message}`, { duration: `${duration}ms` });
};

export default logger;
