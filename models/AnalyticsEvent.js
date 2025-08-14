const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const AnalyticsEventSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, unique: true },
  eventType: { 
    type: String, 
    enum: ['page_view', 'product_view', 'add_to_cart', 'purchase', 'quote_request'],
    required: true 
  },
  eventData: Object,
  userId: String,
  sessionId: String,
  userRole: String,
  browser: String,
  os: String,
  device: String,
  ipAddress: String,
  userAgent: String,
  location: Object,
  referrer: String,
  utmSource: String,
  utmMedium: String,
  utmCampaign: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AnalyticsEvent', AnalyticsEventSchema);
