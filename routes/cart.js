import express from 'express';
import mongoose from 'mongoose';
import Cart from '../models/cart.js';
import Product from '../models/product.js';
import verifyToken from '../middleware/verifyToken.js';

const router = express.Router();

// POST /api/cart/add - Ürün sepete ekle
router.post('/add', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const quantity = Number(req.body.quantity) || 1;
    const rawProductId = req.body.productId;

    if (!mongoose.Types.ObjectId.isValid(rawProductId)) {
      return res.status(400).json({ message: 'Geçersiz ürün ID' });
    }

    const productId = new mongoose.Types.ObjectId(rawProductId);
    const productExists = await Product.findById(productId);
    if (!productExists) {
      return res.status(404).json({ message: 'Ürün bulunamadı' });
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{ product: productId, quantity }]
      });
    } else {
      const existingItem = cart.items.find(item => item.product.toString() === productId.toString());
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ product: productId, quantity });
      }
    }

    await cart.save();
    res.status(200).json(cart);
  } catch (err) {
    console.error('❌ Sepete ekleme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası', error: err });
  }
});

// GET /api/cart - Kullanıcının sepetini getir
router.get('/', verifyToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart) return res.status(200).json({ items: [] });
    res.status(200).json(cart);
  } catch (err) {
    console.error('❌ Sepet alınamadı:', err);
    res.status(500).json({ message: 'Sepet alınamadı', error: err });
  }
});

// DELETE /api/cart/:productId - Sepetten ürün sil
router.delete('/:productId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.params.productId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: 'Sepet bulunamadı' });

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();

    const updatedCart = await Cart.findOne({ user: userId }).populate('items.product');
    res.status(200).json({ message: 'Ürün silindi', cart: updatedCart });
  } catch (err) {
    console.error('❌ Silme hatası:', err);
    res.status(500).json({ message: 'Silme işlemi başarısız', error: err });
  }
});

export default router;
