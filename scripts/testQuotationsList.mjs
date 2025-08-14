const BASE = process.env.BASE || 'http://localhost:5000';

async function login(email, password){
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error('login failed ' + res.status);
  const data = await res.json();
  return data.token;
}

async function get(path, token){
  const res = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

(async ()=>{
  try {
    const centerToken = await login('center@odyostore.com','Center1234-');
    const centerList = await get('/api/quotations/center', centerToken);
    console.log('CENTER LIST STATUS:', centerList.status, 'COUNT:', Array.isArray(centerList.body) ? centerList.body.length : 'N/A');

    const adminToken = await login('admin@odyostore.com','Admin1234-');
    const adminList = await get('/api/quotations/admin', adminToken);
    console.log('ADMIN LIST STATUS:', adminList.status, 'COUNT:', Array.isArray(adminList.body) ? adminList.body.length : 'N/A');

    if (!Array.isArray(centerList.body)) console.log('CENTER BODY:', centerList.body);
    if (!Array.isArray(adminList.body)) console.log('ADMIN BODY:', adminList.body);
  } catch (e) {
    console.error('TEST ERROR:', e);
    process.exit(1);
  }
})();
