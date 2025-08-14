const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const FileUploadSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  userId: String,
  type: { type: String }, // image, document, license, etc.
  filename: String,
  originalName: String,
  url: String,
  size: Number,
  mimeType: String,
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FileUpload', FileUploadSchema);
