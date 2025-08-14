require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const Product = require('../models/Product');
const Order = require('../models/order');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  // Admin user
  await User.create({
    email: 'admin@odyostore.com',
    password: await require('bcryptjs').hash('admin123', 10),
    role: 'admin',
    status: 'approved'
  });

  // Sample supplier
  const supplier = await User.create({
    email: 'tedarikci@odyostore.com',
    password: await require('bcryptjs').hash('sup123', 10),
    role: 'supplier',
    status: 'approved',
    companyInfo: { companyName: 'Test Tedarikçi' }
  });

  // Sample product
  await Product.create({
    name: 'Test İşitme Cihazı',
    categoryId: 'test-cat',
    pricing: { basePrice: 9990, salePrice: 8500, currency: 'TRY' },
    inventory: { stockQuantity: 100 },
    supplierInfo: { supplierId: supplier.id }
  });

  // Sample order
  await Order.create({
    orderNumber: 'ORD-TEST-001',
    userId: supplier.id,
    status: 'confirmed',
    items: [
      { productId: 'test-product-id', productName: 'Test İşitme Cihazı', quantity: 2, unitPrice: 8500 }
    ],
    pricing: { totalAmount: 17000, currency: 'TRY' }
  });

  console.log('Seed başarıyla tamamlandı.');
  process.exit(0);
}

seed();
