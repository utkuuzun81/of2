import * as Iyzico from '../services/payment/iyzicoMock.js';
import * as Aras from '../services/cargo/arasMock.js';
import * as Logo from '../services/accounting/logoMock.js';

export const initPayment = async (req, res) => {
  const { orderId, amount, currency } = req.body;
  const result = Iyzico.initPayment({ orderId, amount, currency });
  res.status(200).json(result);
};

export const verifyPayment = async (req, res) => {
  const { token } = req.body;
  const result = Iyzico.verifyPayment(token);
  res.status(200).json(result);
};

export const createShipment = async (req, res) => {
  const { orderId, address } = req.body;
  const result = Aras.createShipment({ orderId, address });
  res.status(200).json(result);
};

export const trackShipment = async (req, res) => {
  const { trackingNumber } = req.params;
  const result = Aras.getTrackingStatus(trackingNumber);
  res.status(200).json(result);
};

export const generateInvoice = async (req, res) => {
  const { invoiceId, customerName, amount } = req.body;
  const xml = Logo.generateInvoiceXML({ invoiceId, customerName, amount });
  const filePath = Logo.saveInvoiceFile(invoiceId, xml);
  res.status(200).json({ message: 'Fatura oluşturuldu', file: filePath });
};
