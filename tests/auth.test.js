const request = require('supertest');
const app = require('../server'); // Ana app dosyanı buraya göre import et

describe('Auth endpoints', () => {
  it('should not login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fake@mail.com', password: 'wrongpass' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toBe('Kullanıcı bulunamadı.');
  });

  // Daha fazla test ekleyebilirsin...
});
