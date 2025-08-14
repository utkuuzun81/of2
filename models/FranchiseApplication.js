import mongoose from 'mongoose';

const FranchiseApplicationSchema = new mongoose.Schema({
  applicationNumber: { type: String, required: true, unique: true },
  applicantInfo: {
    personalInfo: {
      firstName: String,
      lastName: String,
      phone: String,
      email: String
    },
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
    experienceYears: Number,
    previousFranchises: [String],
    targetLocation: {
      city: String,
      district: String,
      specificAddress: String
    },
    investmentCapacity: {
      amount: Number,
      currency: String,
      fundingSource: String
    }
  },
  documents: [
    {
      type: { type: String, enum: ['identity', 'tax_certificate', 'bank_statement', 'business_plan'] },
      name: String,
      url: String,
      uploadedAt: Date,
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'needs_documents'],
    default: 'pending'
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNotes: String,
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

export default mongoose.model('FranchiseApplication', FranchiseApplicationSchema);
