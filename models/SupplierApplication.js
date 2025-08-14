import mongoose from 'mongoose';

const SupplierApplicationSchema = new mongoose.Schema({
  applicationNumber: { type: String, required: true, unique: true },
  companyDetails: {
    companyInfo: {
      companyName: String,
      taxNumber: String,
      address: {
        street: String,
        district: String,
        city: String,
        postalCode: String,
        country: String
      },
      website: String,
      foundedYear: Number,
      employeeCount: Number,
      licenseNumber: String,
      certifications: [String]
    },
    businessType: String,
    productCategories: [String],
    manufacturingCapacity: {
      monthlyCapacity: Number,
      unit: String,
      scalable: Boolean
    },
    qualityStandards: [String],
    exportExperience: {
      countries: [String],
      yearsExporting: Number
    }
  },
  financialInfo: {
    annualRevenue: Number,
    creditLimit: Number,
    paymentTerms: String,
    currency: String,
    bankReferences: [
      {
        bankName: String,
        accountNumber: String,
        relationship: String
      }
    ]
  },
  productPortfolio: [
    {
      category: String,
      brands: [String],
      productCount: Number,
      priceRange: {
        min: Number,
        max: Number,
        currency: String
      }
    }
  ],
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending'
  },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

export default mongoose.model('SupplierApplication', SupplierApplicationSchema);
