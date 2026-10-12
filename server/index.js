import 'dotenv/config';
import { clerkMiddleware, getAuth } from '@clerk/express';
import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readStore, updateStore, rootDir, uploadDir } from './store.js';
import { stripeSettings, stripeReady, openCheckout, verifyWebhook, getStripe } from './payments/stripe.js';

const app = express();
app.disable('x-powered-by');
app.use(clerkMiddleware());
const PORT = Number(process.env.PORT || 3001);
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.SESSION_SECRET) console.warn('WARNING: SESSION_SECRET unset. Sessions will reset at restart. Set it before deployment.');
if (!process.env.ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD unset. Admin sign-in disabled until configured.');
if (process.env.ADMIN_PASSWORD === 'replace-with-a-strong-unique-password') console.warn('WARNING: change your sample ADMIN_PASSWORD before publishing.');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
function sign(data) { return crypto.createHmac('sha256', sessionSecret).update(data).digest('base64url'); }
function createToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function validToken(token) {
  const [payload, signature] = (token || '').split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url')); return data.role === 'admin' && data.expires > Date.now(); } catch { return false; }
}
function isAdmin(req) {
  if (process.env.CLERK_OWNER_USER_ID && getAuth(req).userId === process.env.CLERK_OWNER_USER_ID) return true;
  const cookie = req.headers.cookie?.split(';').find(x => x.trim().startsWith('catalog_admin='));
  return validToken(cookie?.trim().slice('catalog_admin='.length));
}
function auth(req, res, next) { if (!isAdmin(req)) return res.status(401).json({ error: 'Sign in to manage your shop.' }); next(); }
function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    const allowed = [process.env.PUBLIC_BASE_URL, `${req.protocol}://${req.get('host')}`, `http://${req.get('host')}`, `https://${req.get('host')}`].filter(Boolean).map(x => { try { return new URL(x).origin; } catch { return ''; } });
    if (!allowed.includes(origin)) return res.status(403).json({ error: 'Invalid request origin.' });
  }
  next();
}
const cookieOptions = `HttpOnly; Path=/; SameSite=Strict${isProduction ? '; Secure' : ''}`;

// Customer access is checked on the server. Never embed the shared access code in the frontend.
// In production, fail closed until the code and session secret are configured.
const customerCode = process.env.CUSTOMER_ACCESS_CODE || '';
if (isProduction && (!process.env.CLERK_OWNER_USER_ID || !process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY)) {
  throw new Error('Production requires CLERK_OWNER_USER_ID, CLERK_SECRET_KEY, and CLERK_PUBLISHABLE_KEY.');
}
const customerEnabled = customerCode.length >= 8;
const customerAttempts = new Map();
function customerToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'customer', expires: Date.now() + 1000 * 60 * 60 * 24 * 14 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function customerSession(req) {
  const cookie = req.headers.cookie?.split(';').find(x => x.trim().startsWith('mm_customer='));
  const token = cookie?.trim().slice('mm_customer='.length) || '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url'));
    return data.role === 'customer' && data.expires > Date.now();
  } catch { return false; }
}
function customerAuth(req, res, next) {
  if (getAuth(req).userId) return next();
  if (!customerEnabled) return res.status(401).json({ error: 'Please sign in to browse the catalog.' });
  if (customerSession(req) || isAdmin(req)) return next();
  return res.status(401).json({ error: 'Enter the customer access code to view the catalog.' });
}
function accessCors(req, res, next) {
  const allowed = ['https://chaimh.com', 'https://www.chaimh.com'];
  const origin = req.get('origin');
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  next();
}
const accessPage = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Private catalog — M&M</title><style>body{margin:0;min-height:100vh;background:#0f1111;color:#f6f3ec;font-family:system-ui,Arial;display:grid;place-items:center}.panel{width:min(420px,calc(100vw - 48px));padding:35px;border:1px solid #655536;background:#1b1d1e;border-radius:22px}h1{font-size:28px;margin:14px 0}p{color:#b9b9b3;line-height:1.6}input,button{width:100%;box-sizing:border-box;padding:15px;border-radius:10px;font:inherit}input{background:#101212;color:#fff;border:1px solid #555}button{margin-top:12px;background:#d5b46a;color:#191712;border:0;font-weight:700;cursor:pointer}.mark{color:#d5b46a;font-weight:bold;letter-spacing:.14em}small{color:#d8a8a8;display:block;min-height:18px;margin-top:10px}a{color:#d5b46a}</style></head><body><div class="panel"><div class="mark">M&M · WHOLESALE & LIQUIDATION</div><h1>Private catalog</h1><p>Enter your customer access code to browse available wholesale lots.</p><form id="f"><input id="c" type="password" required minlength="8" autocomplete="off" placeholder="Access code"><button>Unlock catalog →</button><small id="err" role="alert"></small></form><p><a href="https://chaimh.com">← Back to projects</a></p></div><script>document.getElementById('f').addEventListener('submit',async(e)=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;document.getElementById('err').textContent='';try{const r=await fetch('/api/customer/access',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({code:document.getElementById('c').value})});const data=await r.json();if(!r.ok)throw Error(data.error||'Access denied');location.href='/';}catch(e){document.getElementById('err').textContent=e.message;b.disabled=false;}})</script></body></html>`;
app.options('/api/customer/access', accessCors, (_req,res) => res.status(204).end());
app.post('/api/customer/access', accessCors, express.json({ limit: '5kb' }), (req,res) => {
  if (!customerEnabled) return res.status(503).json({ error: 'Customer access is not configured yet.' });
  const ip = req.ip;
  const previous = customerAttempts.get(ip) || { count: 0, start: Date.now() };
  if (Date.now() - previous.start > 15 * 60 * 1000) { previous.count = 0; previous.start = Date.now(); }
  if (previous.count >= 8) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const candidate = String(req.body?.code || '');
  const expected = crypto.createHash('sha256').update(customerCode).digest();
  const actual = crypto.createHash('sha256').update(candidate).digest();
  if (!crypto.timingSafeEqual(expected, actual)) {
    previous.count++;
    customerAttempts.set(ip, previous);
    return res.status(401).json({ error: 'That code is not correct.' });
  }
  customerAttempts.delete(ip);
  res.setHeader('Set-Cookie', `mm_customer=${customerToken()}; Max-Age=1209600; HttpOnly; Path=/; SameSite=Lax${isProduction ? '; Secure' : ''}`);
  res.json({ ok: true });
});
app.get('/access', (_req, res) => res.redirect('/sign-in'));



// IMPORTANT: Stripe needs the unparsed request body to verify webhook signatures.
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  let event;
  try { event = verifyWebhook(req.body, req.get('stripe-signature')); }
  catch (e) { return res.status(400).send(`Webhook verification failed: ${e.message}`); }
  const session = event.data.object;
  const orderId = session.metadata?.order_id || session.client_reference_id;
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type) && orderId) {
    updateStore(db => {
      const order = db.orders.find(o => o.id === orderId && (!o.sessionId || o.sessionId === session.id));
      if (!order || order.status === 'paid') return;
      if (!order.sessionId) order.sessionId = session.id;
      if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && session.payment_status === 'paid') {
        order.status = 'paid';
        order.paidAt = new Date().toISOString();
        order.customerEmail = session.customer_details?.email || null;
        order.amountPaidCents = session.amount_total;
        for (const line of order.items) {
          const product = db.products.find(p => p.id === line.id);
          if (product) product.stock = Math.max(0, product.stock - line.quantity);
        }
      } else if (event.type === 'checkout.session.async_payment_failed') order.status = 'failed';
      else if (event.type === 'checkout.session.expired') order.status = 'expired';
    });
  }
  res.json({ received: true });
});

app.use(express.json({ limit: '500kb' }));
app.use('/uploads', customerAuth, express.static(uploadDir, { maxAge: '1d', index: false }));

app.get('/api/config', (_req, res) => {
  const db = readStore();
  res.json({ settings: db.settings, stripeEnabled: stripeReady(), demoProducts: db.products.filter(p => p.isDemo).length });
});
app.get('/api/products', customerAuth, (_req, res) => {
  res.json(readStore().products.filter(p => p.active).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
});
const loginAttempts = new Map();
app.post('/api/admin/login', sameOrigin, (req, res) => {
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Set ADMIN_PASSWORD in .env to enable admin access.' });
  const ip = req.ip;
  const previous = loginAttempts.get(ip) || { count: 0, start: Date.now() };
  if (Date.now() - previous.start > 15 * 60 * 1000) { previous.count = 0; previous.start = Date.now(); }
  if (previous.count >= 10) return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
  const a = crypto.createHash('sha256').update(String(req.body?.password || '')).digest();
  const b = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(a,b)) {
    previous.count++; loginAttempts.set(ip, previous);
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  loginAttempts.delete(ip);
  res.setHeader('Set-Cookie', `catalog_admin=${createToken()}; Max-Age=604800; ${cookieOptions}`);
  res.json({ ok: true });
});
app.post('/api/admin/logout', sameOrigin, (_req, res) => {
  res.setHeader('Set-Cookie', `catalog_admin=; Max-Age=0; ${cookieOptions}`);
  res.json({ ok: true });
});
app.get('/api/admin/me', (req, res) => res.json({ admin: isAdmin(req), clerkUserId: getAuth(req).userId || null }));
app.get('/api/admin/data', auth, (_req, res) => {
  const db = readStore();
  res.json({ ...db, stripe: { ...stripeSettings(), ready: stripeReady() } });
});

function normalizeProduct(body, previous) {
  const name = String(body.name || '').trim().slice(0, 110);
  const category = String(body.category || 'Other').trim().slice(0, 55);
  const description = String(body.description || '').trim().slice(0, 1400);
  const priceCents = Number(body.priceCents);
  const stock = Number(body.stock);
  const image = String(body.image || '').trim().slice(0, 2000);
  if (!name || !Number.isSafeInteger(priceCents) || priceCents < 50 || priceCents > 99999999) throw new Error('Add a name and a valid price of at least $0.50.');
  if (!Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) throw new Error('Stock must be a whole number from 0 to 1,000,000.');
  if (image && !(image.startsWith('/uploads/') || image.startsWith('/demo/') || /^https:\/\//i.test(image))) throw new Error('Use an uploaded image or an HTTPS image URL.');
  return {
    ...previous,
    name, category, description, priceCents, stock, image,
    color: /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#f0efea',
    active: body.active === true,
    featured: body.featured === true,
    isDemo: false
  };
}
app.post('/api/admin/products', sameOrigin, auth, (req, res) => {
  try {
    const product = { ...normalizeProduct(req.body, {}), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    updateStore(db => db.products.unshift(product));
    res.status(201).json(product);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.patch('/api/admin/products/:id', sameOrigin, auth, (req, res) => {
  try {
    let product;
    updateStore(db => {
      const index = db.products.findIndex(p => p.id === req.params.id);
      if (index < 0) throw new Error('Product not found.');
      product = normalizeProduct(req.body, db.products[index]);
      db.products[index] = product;
    });
    res.json(product);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/products/:id', sameOrigin, auth, (req, res) => {
  updateStore(db => { db.products = db.products.filter(p => p.id !== req.params.id); });
  res.json({ ok: true });
});
app.delete('/api/admin/demo-products', sameOrigin, auth, (_req, res) => {
  updateStore(db => { db.products = db.products.filter(p => !p.isDemo); });
  res.json({ ok: true });
});
app.patch('/api/admin/settings', sameOrigin, auth, (req, res) => {
  const fields = { name: 70, eyebrow: 70, headline: 130, tagline: 300, announcement: 140, supportEmail: 160 };
  updateStore(db => {
    for (const [key, max] of Object.entries(fields)) if (typeof req.body[key] === 'string') db.settings[key] = req.body[key].trim().slice(0, max);
  });
  res.json(readStore().settings);
});
const uploader = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.${({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[file.mimetype] || 'bin'}`)
  }),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype))
});
app.post('/api/admin/upload', sameOrigin, auth, (req, res) => {
  uploader.single('image')(req, res, err => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be under 4 MB.' : 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'Choose a JPG, PNG, WEBP, or GIF file.' });
    // Check actual file signatures, not just the browser-provided MIME type.
    const bytes = fs.readFileSync(req.file.path);
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
    const gif = ['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString());
    const webp = bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
    const actual = jpg ? 'image/jpeg' : png ? 'image/png' : gif ? 'image/gif' : webp ? 'image/webp' : null;
    if (!actual || actual !== req.file.mimetype) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'The file is not a valid image.' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});
app.post('/api/checkout', sameOrigin, customerAuth, async (req, res) => {
  if (!stripeReady()) return res.status(503).json({ error: 'Secure checkout is not connected yet. Your cart is saved in this browser.' });
  const input = req.body?.items;
  if (!Array.isArray(input) || input.length < 1 || input.length > 40) return res.status(400).json({ error: 'Invalid cart.' });
  const ids = new Set();
  const items = [];
  for (const entry of input) {
    const id = String(entry?.id || '');
    const quantity = Number(entry?.quantity);
    if (ids.has(id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) return res.status(400).json({ error: 'Invalid quantity in cart.' });
    ids.add(id);
    const product = readStore().products.find(p => p.id === id);
    if (!product || !product.active || product.isDemo) return res.status(400).json({ error: 'A product is no longer for sale. Please review your cart.' });
    if (product.stock < quantity) return res.status(400).json({ error: `${product.name} has only ${product.stock} available.` });
    items.push({ product, quantity });
  }
  const totalCents = items.reduce((sum, {product, quantity}) => sum + product.priceCents * quantity, 0);
  if (totalCents < 50 || totalCents > 100000000) return res.status(400).json({ error: 'Cart total out of range.' });
  const orderId = crypto.randomUUID();
  const order = {
    id: orderId, status: 'creating', createdAt: new Date().toISOString(), totalCents,
    items: items.map(({product, quantity}) => ({ id: product.id, name: product.name, quantity, unitPriceCents: product.priceCents }))
  };
  updateStore(db => db.orders.unshift(order));
  try {
    const session = await openCheckout({ items, orderId });
    updateStore(db => { const o = db.orders.find(o => o.id === orderId); o.sessionId = session.id; if (o.status === 'creating') o.status = 'pending'; });
    res.json({ url: session.url });
  } catch (e) {
    updateStore(db => { const o = db.orders.find(o => o.id === orderId); o.status = 'error'; });
    console.error('Stripe checkout error:', e.message);
    res.status(502).json({ error: 'Could not open checkout. Please try again.' });
  }
});
app.get('/api/checkout/status/:sessionId', customerAuth, async (req, res) => {
  if (!stripeReady() || !/^cs_(test_)?[a-zA-Z0-9]+$/.test(req.params.sessionId)) return res.status(404).json({ error: 'Checkout not found.' });
  try {
    const session = await getStripe().checkout.sessions.retrieve(req.params.sessionId);
    res.json({ paid: session.payment_status === 'paid', status: session.status });
  } catch { res.status(404).json({ error: 'Checkout not found.' }); }
});

const dist = path.join(rootDir, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
    if (!req.path.startsWith('/sign-in') && !req.path.startsWith('/sign-up') && !getAuth(req).userId && !customerSession(req) && !isAdmin(req)) return res.redirect('/sign-in');
    res.sendFile(path.join(dist, 'index.html'));
  });
}
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); });
app.listen(PORT, () => console.log(`Storefront API http://localhost:${PORT} (Stripe: ${stripeReady() ? 'configured' : 'not connected'})`));