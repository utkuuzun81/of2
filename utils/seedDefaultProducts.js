// utils/seedDefaultProducts.js
import Product from '../models/product.js'; // ÖNEMLİ: göreli yol + .js uzantısı + doğru KASA

export async function seedDefaultProducts() {
  // Zaten varsa tekrar ekleme
  const exists = await Product.findOne({ name: 'Demo İşitme Cihazı' });
  if (exists) {
    console.log('[SEED] Default product already exists');
    return;
  }

  await Product.create({
    name: 'Demo İşitme Cihazı',
    sku: 'DEMO-IC-001',
    pricing: { basePrice: 15000, currency: 'TRY' },
    media: {
      images: [{ id: 'img-1', url: '/uploads/misc/placeholder.png', alt: 'Demo', isPrimary: true }]
    },
    status: 'active'
  });

  console.log('[SEED] Created default product');
}
