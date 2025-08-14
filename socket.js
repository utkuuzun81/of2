import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // İstersen process.env.ALLOWED_ORIGINS ile güncelleyebilirsin
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      socket.join(userId);
      console.log(`🔌 Kullanıcı bağlandı: ${userId}`);
    }

    socket.on('disconnect', () => {
      console.log(`⛔ Kullanıcı ayrıldı: ${userId}`);
    });
  });

  // Expose globally for utils/emitNotification
  try { global.io = io; } catch {}

  return io;
};

export const getSocket = () => io;
