import express from 'express';
import * as productController from '../controllers/productController.js';
import verifyToken from '../middleware/verifyToken.js';
import roleAuth from '../middleware/roleAuth.js';
import auditLogger from '../middleware/auditLogger.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Auth zorunlu (ürünler misafire görünmez)
router.get('/', verifyToken, productController.listProducts);
router.get('/search', verifyToken, productController.searchProducts);
router.get('/categories', verifyToken, productController.listCategories);
router.get('/brands', verifyToken, productController.listBrands);
router.get('/supplier/:supplierId', verifyToken, productController.listSupplierProducts);
router.get('/:id', verifyToken, productController.getProduct);

// Auth zorunlu alanlar
router.post(
  '/',
  verifyToken,
  roleAuth(['admin', 'supplier']),
  productController.createProduct,
  auditLogger(
    'PRODUCT_CREATE', 'Product',
    (req, res) => res.locals.createdProductId,
    (req, res) => ({ oldValue: null, newValue: res.locals.newProduct })
  )
);

router.put(
  '/:id',
  verifyToken,
  roleAuth(['admin', 'supplier']),
  productController.updateProduct,
  auditLogger(
    'PRODUCT_UPDATE', 'Product',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: res.locals.oldProduct, newValue: res.locals.updatedProduct })
  )
);

router.delete(
  '/:id',
  verifyToken,
  roleAuth(['admin', 'supplier']),
  productController.deleteProduct,
  auditLogger(
    'PRODUCT_SOFT_DELETE', 'Product',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: res.locals.oldProduct, newValue: { isDeleted: true } })
  )
);

// Statü
router.put(
  '/:id/status',
  verifyToken,
  roleAuth(['admin']),
  productController.updateProductStatus,
  auditLogger(
    'PRODUCT_STATUS_UPDATE', 'Product',
    (req, res) => req.params.id,
    (req, res) => ({ oldValue: res.locals.oldProduct, newValue: res.locals.updatedProduct })
  )
);

// Media yönetimi (audit log opsiyonel)
router.post('/:id/images', verifyToken, roleAuth(['admin', 'supplier']), upload.single('file'), productController.uploadProductImage);
router.delete('/:id/images/:imageId', verifyToken, roleAuth(['admin', 'supplier']), productController.deleteProductImage);
router.put('/:id/images/:imageId/primary', verifyToken, roleAuth(['admin', 'supplier']), productController.setPrimaryImage);

export default router;
