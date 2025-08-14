import path from 'path';
import fs from 'fs';

// S3 hariç local için
export const uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya yüklenemedi.' });

  const fileUrl = `/uploads/${req.file.filename}`;
  res.status(200).json({
    name: req.file.filename,
    path: req.file.path,
    url: fileUrl
  });
};

export const uploadDocument = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Belge yüklenemedi.' });

  const fileUrl = `/uploads/${req.file.filename}`;
  res.status(200).json({
    name: req.file.filename,
    path: req.file.path,
    url: fileUrl
  });
};

// Dosya sunumu
export const getFile = async (req, res) => {
  const filePath = path.join('uploads', req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Dosya bulunamadı' });
  }
  res.sendFile(path.resolve(filePath));
};

// Silme
export const deleteFile = async (req, res) => {
  const filePath = path.join('uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.status(200).json({ message: 'Dosya silindi' });
  } else {
    res.status(404).json({ message: 'Dosya bulunamadı' });
  }
};
