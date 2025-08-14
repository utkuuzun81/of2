export const createShipment = ({ orderId, address }) => {
  const trackingNumber = 'ARA' + Math.floor(Math.random() * 1000000000);
  return {
    trackingNumber,
    carrier: 'Aras Kargo',
    status: 'Hazırlanıyor',
    estimatedDelivery: new Date(Date.now() + 3 * 86400000),
    address,
    orderId
  };
};

export const getTrackingStatus = (trackingNumber) => {
  const statuses = ['Hazırlanıyor', 'Kargoya Verildi', 'Yolda', 'Teslim Edildi'];
  const random = Math.floor(Math.random() * statuses.length);
  return {
    trackingNumber,
    status: statuses[random],
    delivered: statuses[random] === 'Teslim Edildi',
    updatedAt: new Date()
  };
};
