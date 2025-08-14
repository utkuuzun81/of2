export const initPayment = ({ orderId, amount, currency }) => {
  return {
    status: 'success',
    iyzicoToken: 'iyz-' + Date.now(),
    paymentUrl: `https://mock-iyzico.com/pay/${orderId}`,
    amount,
    currency,
    orderId
  };
};

export const verifyPayment = (token) => {
  const success = token?.startsWith('iyz-');
  return {
    status: success ? 'paid' : 'failed',
    message: success ? 'Ödeme başarılı' : 'Geçersiz token',
    paidAt: success ? new Date() : null
  };
};
