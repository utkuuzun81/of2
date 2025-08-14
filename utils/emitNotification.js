// server/utils/emitNotification.js

// Odyostore için temel emit notification fonksiyonu
// io objesini app.set('io', io) ile eklediğini varsayıyoruz

export default function emitNotification(userId, notification) {
  // Express app'e bağlı io nesnesini bul
  const io = global.io || (globalThis && globalThis.io);

  // Veya app.locals/io farklı bir yöntem kullanıyorsan:
  // const io = req.app.get('io');

  if (io) {
    io.to(userId).emit('notification', notification);
    console.log(`Bildirim gönderildi: User: ${userId} - Notif:`, notification);
  } else {
    console.log('io nesnesi bulunamadı, bildirim gönderilemedi.');
  }
}

