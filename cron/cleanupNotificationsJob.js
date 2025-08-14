import cron from 'node-cron';
import Notification from '../models/Notification.js';

export const startNotificationCleanupJob = () => {
  cron.schedule('0 3 * * *', async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await Notification.deleteMany({ createdAt: { $lt: cutoff } });
    console.log(`🧹 ${result.deletedCount} eski bildirim silindi`);
  });
};
