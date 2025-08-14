import SupplierApplication from '../models/SupplierApplication.js';

export const applySupplier = async (req, res) => {
  const newApp = new SupplierApplication(req.body);
  await newApp.save();

  res.locals.oldValue = null;
  res.locals.newValue = newApp;
  res.status(201).json(newApp);
};

export const updateMyApplication = async (req, res) => {
  const { userId } = req.user;
  const existing = await SupplierApplication.findOne({ _id: req.params.id, isDeleted: false });
  if (!existing) return res.status(404).json({ message: 'Başvuru bulunamadı' });

  const updated = await SupplierApplication.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.locals.oldValue = existing;
  res.locals.newValue = updated;
  res.status(200).json(updated);
};

export const deleteSupplierApplication = async (req, res) => {
  const existing = await SupplierApplication.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Başvuru bulunamadı' });

  existing.isDeleted = true;
  await existing.save();

  res.locals.oldValue = existing;
  res.locals.newValue = { ...existing.toObject(), isDeleted: true };
  res.status(200).json({ message: 'Silindi' });
};

export const getAllApplications = async (req, res) => {
  const applications = await SupplierApplication.find({ isDeleted: false });
  res.status(200).json(applications);
};
