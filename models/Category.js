const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CategorySchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  name: { type: String, required: true },
  slug: String,
  description: String,
  parentId: { type: String, default: null },
  imageUrl: String,
  isActive: { type: Boolean, default: true },
  sortOrder: Number,
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String]
});

module.exports = mongoose.model('Category', CategorySchema);
