import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Order from '../models/order.js';
import LoyaltyTransaction from '../models/LoyaltyTransaction.js';

// Helper: parse date range safely
function parseDateRange(query) {
  const now = new Date();
  const defFrom = new Date(now);
  defFrom.setDate(now.getDate() - 30);
  let { from, to } = query || {};
  const parsedFrom = from ? new Date(from) : defFrom;
  const parsedTo = to ? new Date(to) : now;
  if (Number.isNaN(parsedFrom.getTime())) return { from: defFrom, to: parsedTo };
  if (Number.isNaN(parsedTo.getTime())) return { from: parsedFrom, to: now };
  return { from: parsedFrom, to: parsedTo };
}

export const exportOrders = async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const isSupplier = req.user?.role === 'supplier';
    const baseFilter = { isDeleted: { $ne: true } };
    const { from, to } = parseDateRange(req.query);
    const rangeFilter = { createdAt: { $gte: from, $lte: to } };
    const status = req.query.status;
    const statusFilter = status ? { status } : {};
    const filter = isSupplier
      ? { ...baseFilter, ...rangeFilter, ...statusFilter, supplierId: req.user?.id || req.user?._id?.toString() }
      : { ...baseFilter, ...rangeFilter, ...statusFilter };
    const orders = await Order.find(filter);

    if (format === 'csv') {
      const fields = ['orderNumber', 'userId', 'supplierId', 'status', 'totalAmount', 'createdAt'];
      const parser = new Parser({ fields });
      const csv = parser.parse(orders.map(order => ({
        orderNumber: order.orderNumber,
        userId: order.userId,
        supplierId: order.supplierId,
        status: order.status,
        totalAmount: order?.pricing?.totalAmount ?? 0,
        createdAt: order.createdAt
      })));

      res.header('Content-Type', 'text/csv');
      res.attachment('orders.csv');
      return res.send(csv);
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Siparişler');

      sheet.columns = [
        { header: 'Sipariş No', key: 'orderNumber', width: 20 },
        { header: 'Kullanıcı', key: 'userId', width: 30 },
        { header: 'Tedarikçi', key: 'supplierId', width: 30 },
        { header: 'Durum', key: 'status', width: 15 },
        { header: 'Tutar', key: 'totalAmount', width: 15 },
        { header: 'Tarih', key: 'createdAt', width: 25 }
      ];

      orders.forEach(order => {
        sheet.addRow({
          orderNumber: order.orderNumber,
          userId: order.userId,
          supplierId: order.supplierId,
          status: order.status,
          totalAmount: order?.pricing?.totalAmount ?? 0,
          createdAt: order.createdAt
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    }

  if (format === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=orders.pdf');
      doc.pipe(res);

      doc.fontSize(16).text('Sipariş Raporu', { align: 'center' }).moveDown();
      orders.forEach(order => {
        doc
          .fontSize(12)
      .text(`Sipariş: ${order.orderNumber} - Tutar: ${(order?.pricing?.totalAmount ?? 0)} TL - Durum: ${order.status} - Tedarikçi: ${order.supplierId || '-'}`)
          .moveDown(0.5);
      });

      doc.end();
    }

  } catch (err) {
    console.error('Export hatası:', err);
    res.status(500).json({ message: 'Export işlemi sırasında hata oluştu.' });
  }
};

// Orders summary for charts/dashboards
export const orderSummary = async (req, res) => {
  try {
    const isSupplier = req.user?.role === 'supplier';
    const baseMatch = { isDeleted: { $ne: true } };
    const { from, to } = parseDateRange(req.query);
    const status = req.query.status;
    const match = {
      ...baseMatch,
      createdAt: { $gte: from, $lte: to },
      ...(status ? { status } : {})
    };
    if (isSupplier) match.supplierId = req.user?.id || req.user?._id?.toString();

    // totals
    const [totals] = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$pricing.totalAmount', 0] } }
        }
      }
    ]);

    // byStatus
    const byStatus = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$pricing.totalAmount', 0] } }
        }
      },
      { $project: { _id: 0, status: '$_id', count: 1, revenue: 1 } },
      { $sort: { status: 1 } }
    ]);

    // byDay (YYYY-MM-DD)
    const byDay = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$pricing.totalAmount', 0] } }
        }
      },
      { $project: { _id: 0, day: '$_id', count: 1, revenue: 1 } },
      { $sort: { day: 1 } }
    ]);

    const totalOrders = totals?.totalOrders ?? 0;
    const totalRevenue = totals?.totalRevenue ?? 0;
    const avgOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

    res.json({
      range: { from, to },
      totals: { totalOrders, totalRevenue, avgOrderValue },
      byStatus,
      byDay
    });
  } catch (err) {
    console.error('orderSummary hata:', err);
    res.status(500).json({ message: 'Rapor özetinde hata oluştu.' });
  }
};

// Loyalty transactions export (admin only)
export const exportLoyalty = async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const userId = req.query.userId; // optional filter
    const format = req.query.format || 'csv';
    const match = {
      createdAt: { $gte: from, $lte: to },
      ...(userId ? { userId } : {})
    };
    const tx = await LoyaltyTransaction.find(match).sort({ createdAt: 1 }).lean();

    if (format === 'csv') {
      const fields = ['userId', 'orderId', 'type', 'amount', 'reason', 'createdAt'];
      const parser = new Parser({ fields });
      const csv = parser.parse(
        tx.map(t => ({
          userId: t.userId,
          orderId: t.orderId || '',
          type: t.type,
          amount: t.amount,
          reason: t.reason || '',
          createdAt: t.createdAt
        }))
      );
      res.header('Content-Type', 'text/csv');
      res.attachment('loyalty.csv');
      return res.send(csv);
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Puan İşlemleri');
      sheet.columns = [
        { header: 'Kullanıcı', key: 'userId', width: 26 },
        { header: 'Sipariş', key: 'orderId', width: 26 },
        { header: 'Tip', key: 'type', width: 12 },
        { header: 'Miktar', key: 'amount', width: 12 },
        { header: 'Açıklama', key: 'reason', width: 40 },
        { header: 'Tarih', key: 'createdAt', width: 24 }
      ];
      tx.forEach(t => sheet.addRow({
        userId: t.userId?.toString?.() || t.userId,
        orderId: t.orderId?.toString?.() || '',
        type: t.type,
        amount: t.amount,
        reason: t.reason || '',
        createdAt: t.createdAt
      }));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=loyalty.xlsx');
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (format === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=loyalty.pdf');
      doc.pipe(res);
      doc.fontSize(16).text('Puan İşlemleri Raporu', { align: 'center' }).moveDown();
      tx.forEach(t => {
        doc.fontSize(12).text(
          `${new Date(t.createdAt).toLocaleString('tr-TR')} | ${t.type} | ${t.amount} | user=${t.userId} | order=${t.orderId || '-'} | ${t.reason || ''}`
        ).moveDown(0.3);
      });
      doc.end();
      return;
    }

    // default JSON
    res.json(tx);
  } catch (err) {
    console.error('exportLoyalty hata:', err);
    res.status(500).json({ message: 'Loyalty export sırasında hata oluştu.' });
  }
};
