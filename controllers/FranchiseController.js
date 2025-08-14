import FranchiseApplication from '../models/franchiseApplication.js';

export const applyFranchise = async (req, res) => {
  const application = await FranchiseApplication.create({
    applicationNumber: 'FRA-' + Date.now(),
    applicantInfo: req.body.applicantInfo,
    documents: req.body.documents || [],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  res.locals.oldValue = null;
  res.locals.newValue = application;
  res.status(201).json(application);
};

export const updateMyApplication = async (req, res) => {
  const existing = await FranchiseApplication.findOne({ _id: req.params.id, isDeleted: false });
  if (!existing) return res.status(404).json({ message: 'Başvuru bulunamadı' });

  const updated = await FranchiseApplication.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.locals.oldValue = existing;
  res.locals.newValue = updated;
  res.status(200).json(updated);
};

export const getMyApplication = async (req, res) => {
  const application = await FranchiseApplication.findOne({
    'applicantInfo.personalInfo.email': req.user.email,
    isDeleted: false
  });
  if (!application) return res.status(404).json({ message: 'Başvuru bulunamadı' });
  res.status(200).json(application);
};

export const getApprovedFranchises = async (req, res) => {
  const list = await FranchiseApplication.find({ status: 'approved', isDeleted: false });
  res.status(200).json(list);
};

export const getAllApplicationsAdmin = async (req, res) => {
  const list = await FranchiseApplication.find({ isDeleted: false });
  res.status(200).json(list);
};

export const updateApplicationStatus = async (req, res) => {
  const existing = await FranchiseApplication.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Başvuru bulunamadı' });

  existing.status = req.body.status;
  existing.reviewNotes = req.body.reviewNotes;
  existing.reviewedBy = req.user.id;
  existing.reviewedAt = new Date();
  existing.updatedAt = new Date();
  await existing.save();

  res.locals.oldValue = null;
  res.locals.newValue = existing;
  res.status(200).json(existing);
};

export const deleteApplication = async (req, res) => {
  const existing = await FranchiseApplication.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Başvuru bulunamadı' });

  existing.isDeleted = true;
  await existing.save();

  res.locals.oldValue = existing;
  res.locals.newValue = { ...existing.toObject(), isDeleted: true };
  res.status(200).json({ message: 'Silindi' });
};
