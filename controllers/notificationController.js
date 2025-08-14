import Notification from '../models/notification.js';
import emitNotification from '../utils/emitNotification.js';
import mongoose from 'mongoose';

// Kullanıcı bildirimlerini getir
export const getUserNotifications = async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(notifs);
  } catch (err) {
    res.status(500).json({ message: 'Bildirimler alınamadı', error: err.message });
  }
};

// Okundu işaretle
export const markAsRead = async (req, res) => {
  try {
    // Parametre hem Mongo _id hem de uuid 'id' alanı olabilir
    const or = [{ id: req.params.id }];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      or.push({ _id: req.params.id });
    }
    const query = { userId: req.user.id, $or: or };
    const notif = await Notification.findOneAndUpdate(
      query,
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Bildirim bulunamadı' });
    res.json({ message: 'Okundu olarak işaretlendi', notif });
  } catch (err) {
    res.status(500).json({ message: 'Bildirim güncellenemedi', error: err.message });
  }
};

// Tüm bildirimleri okundu işaretle
export const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: { $ne: true } },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ message: 'Tüm bildirimler okundu olarak işaretlendi', matched: result.matchedCount ?? result.n, modified: result.modifiedCount ?? result.nModified });
  } catch (err) {
    res.status(500).json({ message: 'Toplu güncelleme başarısız', error: err.message });
  }
};

// Admin: bildirim gönder
export const sendBulkNotification = async (req, res) => {
  try {
    const { userId, ...data } = req.body;

    const notif = await Notification.create({
      userId,
      ...data,
      createdAt: new Date()
    });

    // Socket ile bildirimi gönder
    emitNotification(userId, notif);

    res.status(201).json({ message: 'Bildirim gönderildi', id: notif.id });
  } catch (err) {
    res.status(500).json({ message: 'Bildirim gönderilemedi', error: err.message });
  }
};

// Bildirim sil
export const deleteNotification = async (req, res) => {
  try {
    const or = [{ id: req.params.id }];
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      or.push({ _id: req.params.id });
    }
    const deleted = await Notification.findOneAndDelete({ userId: req.user.id, $or: or });
    if (!deleted) return res.status(404).json({ message: 'Bildirim bulunamadı' });
    res.json({ message: 'Bildirim silindi' });
  } catch (err) {
    res.status(500).json({ message: 'Bildirim silinemedi', error: err.message });
  }
};
