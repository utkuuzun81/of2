
const dashboardController = {
  getAdminDashboard: async (req, res) => {
    // Kullanıcı, sipariş, ürün, tedarikçi, finans vb. özet veriler
    res.json({ summary: 'Admin dashboard datası' });
  },
  getCenterDashboard: async (req, res) => {
    // Kendi satış, teklif, sipariş istatistikleri
    res.json({ summary: 'Merkez dashboard datası' });
  },
  getSupplierDashboard: async (req, res) => {
    // Tedarikçi satış, ürün, sipariş istatistikleri
    res.json({ summary: 'Tedarikçi dashboard datası' });
  },
  getSalesAnalytics: async (req, res) => {
    // Satış analitiği (ciro, toplam sipariş vs.)
    res.json({ summary: 'Satış analitik datası' });
  },
  getProductsAnalytics: async (req, res) => {
    // Ürün analitik raporu (en çok satan, stok vs.)
    res.json({ summary: 'Ürün analitik datası' });
  }
};

export default dashboardController;
