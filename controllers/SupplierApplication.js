const mongoose = require('mongoose');

const SupplierApplicationSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: () => require('uuid').v4() },
  applicationNumber: String,
  companyDetails: Object,
  financialInfo: Object,
  productPortfolio: [Object],
  status: { 
    type: String, 
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SupplierApplication', SupplierApplicationSchema);
