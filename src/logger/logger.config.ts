import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { TelegramTransport } from './telegram.transport';

export const winstonLogger = WinstonModule.createLogger({
  transports: [
    // Log ra console (dev đọc)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(), // Tô màu theo cấp độ
        winston.format.printf(({ level, message, context, timestamp }) => {
          return `[${timestamp}] [${context || 'App'}] ${level}: ${message}`;
        }),
      ),
    }),

    new TelegramTransport({
      botToken: process.env.TELEGRAM_BOT_TOKEN || '8504913793:AAHwuc49RgKVtWKzpbQZDRSjkGCKuCDv9Ko',
      chatId: process.env.TELEGRAM_CHAT_ID || '-5029849067',
    }),
  ],
});