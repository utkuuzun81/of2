import cron from 'node-cron';
import Order from '../models/order.js';
import fs from 'fs';
import path from 'path';

// Haftalık PDF sipariş özeti
export const startWeeklyReportJob = () => {
  cron.schedule('0 9 * * 1', async () => {
    console.log('📊 Haftalık rapor başlatıldı');

    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);

    const orders = await Order.find({
      createdAt: { $gte: oneWeekAgo, $lte: now },
      isDeleted: { $ne: true }
    });

    const reportData = orders.map(o => ({
      orderNumber: o.orderNumber,
      total: o.pricing.totalAmount,
      status: o.status
    }));

    const filePath = path.join('reports', `weekly-report-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));

    console.log(`✅ Rapor oluşturuldu: ${filePath}`);
  });
};
