import fs from 'fs';
import path from 'path';

export const generateInvoiceXML = ({ invoiceId, customerName, amount }) => {
  const xml = `
  <Invoice>
    <ID>${invoiceId}</ID>
    <Customer>${customerName}</Customer>
    <Amount>${amount}</Amount>
    <Currency>TRY</Currency>
    <Date>${new Date().toISOString()}</Date>
  </Invoice>
  `;
  return xml.trim();
};

export const saveInvoiceFile = (invoiceId, xmlContent) => {
  const filePath = path.join('invoices', `${invoiceId}.xml`);
  if (!fs.existsSync('invoices')) fs.mkdirSync('invoices');
  fs.writeFileSync(filePath, xmlContent);
  return filePath;
};
