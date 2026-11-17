import crypto from 'crypto';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import {
  appendAuditLog,
  findCategoryName,
  loadDb,
  resetDb,
  saveDb,
  toPublicUser,
} from './db.ts';
import type {
  AuditEvent,
  DashboardSummary,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PublicUser,
  TopCommodity,
} from '../src/types.ts';

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  const seed = process.env.VERCEL_URL || process.env.APP_URL || 'tangkolomart-local-dev-only';
  return crypto.createHash('sha256').update(seed).digest('hex');
}

const TOKEN_SECRET = getSessionSecret();

interface TokenPayload {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  exp: number;
}

interface AuthedRequest extends Request {
  authUser?: PublicUser;
}

// --- Security Helpers ---

function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120;
}

function isValidPhone(phone: string): boolean {
  if (!phone) return true;
  return /^[0-9+\-\s()]{8,20}$/.test(phone);
}

function validateStrongPassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password minimal 8 karakter.';
  }
  if (password.length > 128) {
    return 'Password maksimal 128 karakter.';
  }
  const weakList = ['password', '12345678', '123456789', 'qwerty123', 'admin123', 'tangkolomart'];
  if (weakList.includes(password.toLowerCase())) {
    return 'Password terlalu umum dan lemah. Gunakan kombinasi huruf besar, kecil, dan angka.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password wajib mengandung minimal 1 huruf kecil, 1 huruf besar, dan 1 angka.';
  }
  return null;
}

function isSafeImageUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/src/assets/images/') && !url.includes('..')) {
    return /\.(jpg|jpeg|png|webp)$/i.test(url);
  }
  return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
}

// --- In-Memory Rate Limiter (Brute-Force Protection) ---
interface RateRecord {
  count: number;
  resetAt: number;
}

const loginFailureStore = new Map<string, RateRecord>();
const registerRateStore = new Map<string, RateRecord>();
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

function getLoginRateStatus(ip: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const rec = loginFailureStore.get(ip);
  if (!rec) return { blocked: false, retryAfterSec: 0 };
  if (now > rec.resetAt) {
    loginFailureStore.delete(ip);
    return { blocked: false, retryAfterSec: 0 };
  }
  if (rec.count >= MAX_LOGIN_FAILURES) {
    return { blocked: true, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

function recordLoginFailure(ip: string): number {
  const now = Date.now();
  const rec = loginFailureStore.get(ip);
  if (!rec || now > rec.resetAt) {
    loginFailureStore.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return 1;
  }
  rec.count += 1;
  return rec.count;
}

function clearLoginFailures(ip: string): void {
  loginFailureStore.delete(ip);
}

function checkRegisterRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = registerRateStore.get(ip);
  if (!rec || now > rec.resetAt) {
    registerRateStore.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (rec.count >= 10) return false;
  rec.count += 1;
  return true;
}

// --- Security Headers & CSRF Origin Guard ---
function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (process.env.VERCEL) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    process.env.VERCEL
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self';"
      : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com;",
  );
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }
  // Bearer token requests are immune to ambient cookie CSRF
  if (req.headers.authorization?.startsWith('Bearer ')) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        res.status(403).json({ error: 'Permintaan ditolak oleh proteksi CSRF Origin.' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Header Origin tidak valid.' });
      return;
    }
  }
  next();
}

function isSecureRequest(req: Request): boolean {
  return (
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    Boolean(process.env.VERCEL) ||
    process.env.NODE_ENV === 'production'
  );
}

// --- Token & Auth Helpers ---
function signToken(payload: TokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return sanitizeText(forwarded.split(',')[0], 64);
  }
  return sanitizeText(req.socket?.remoteAddress || req.ip || '::1', 64);
}

function extractUserAgent(req: Request): string {
  return sanitizeText(String(req.headers['user-agent'] || 'Unknown'), 240);
}

function extractTokenFromReq(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((part) => part.trim());
    for (const c of cookies) {
      if (c.startsWith('tm_token=')) {
        return decodeURIComponent(c.slice('tm_token='.length));
      }
    }
  }
  return null;
}

function attachUserMiddleware(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = extractTokenFromReq(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const db = loadDb();
      const found = db.users.find((u) => u.id === payload.userId);
      if (found) {
        req.authUser = toPublicUser(found);
      }
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Silakan masuk terlebih dahulu untuk melanjutkan.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Sesi admin diperlukan.' });
    return;
  }
  if (req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Khusus pengelola BUMDes (Admin).' });
    return;
  }
  next();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function computeTopCommodities(orders: Order[]): TopCommodity[] {
  const validOrders = orders.filter((o) => o.status !== 'Dibatalkan');
  const map = new Map<string, TopCommodity>();
  for (const order of validOrders) {
    for (const item of order.items) {
      if (item.productId.includes('fee') || item.productId.includes('extra')) continue;
      const existing = map.get(item.productId);
      const lineRevenue = item.price * item.quantity;
      if (existing) {
        existing.unitsSold += item.quantity;
        existing.revenue += lineRevenue;
      } else {
        map.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          unitsSold: item.quantity,
          revenue: lineRevenue,
        });
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .slice(0, 5);
}

function formatRpSimple(num: number): string {
  return `Rp ${num.toLocaleString('id-ID')}`;
}

export function createApiApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '5mb' }));
  app.use(csrfProtectionMiddleware);
  app.use(attachUserMiddleware);

  // Initialize database on boot
  loadDb();

  // --- Health & DB Status / Reset ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'TangkoloMart API' });
  });

  app.get('/api/db/status', (_req, res) => {
    const db = loadDb();
    res.json({
      status: 'online',
      engine: process.env.VERCEL
        ? 'Vercel Serverless Ephemeral Store + Bcrypt Auth'
        : 'JSON Persisted Store + Bcrypt Auth',
      lastUpdatedAt: db.meta.lastUpdatedAt,
      counts: {
        products: db.products.length,
        activeProducts: db.products.filter((p) => p.isActive).length,
        categories: db.categories.length,
        users: db.users.length,
        orders: db.orders.length,
        auditLogs: db.auditLogs.length,
      },
    });
  });

  // Protected: only Admin can reset DB (prevents unauthorized destructive action)
  app.post('/api/db/reset', requireAdmin, (req: AuthedRequest, res) => {
    const username = req.authUser!.username;
    const fresh = resetDb(username, extractClientIp(req), extractUserAgent(req));
    res.json({
      ok: true,
      message: 'Database berhasil dikembalikan ke data awal Desa Tangkolo.',
      counts: {
        products: fresh.products.length,
        categories: fresh.categories.length,
        orders: fresh.orders.length,
        users: fresh.users.length,
      },
    });
  });

  // --- Auth Routes ---
  app.get('/api/auth/me', (req: AuthedRequest, res) => {
    if (!req.authUser) {
      res.status(401).json({ user: null });
      return;
    }
    res.json({ user: req.authUser });
  });

  app.post('/api/auth/register', async (req: AuthedRequest, res) => {
    const clientIp = extractClientIp(req);
    if (!checkRegisterRateLimit(clientIp)) {
      res.status(429).json({ error: 'Terlalu banyak percobaan registrasi. Coba lagi nanti.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const fullName = sanitizeText(body.fullName, 100);
    const rawUsername = sanitizeText(body.username, 40);
    const email = sanitizeText(body.email, 120).toLowerCase();
    const phone = sanitizeText(body.phone, 25);
    const address = sanitizeText(body.address, 250);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!fullName || !rawUsername || !email || !password) {
      res.status(400).json({ error: 'Nama lengkap, username, email aktif, dan password wajib diisi.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Format alamat email tidak valid.' });
      return;
    }
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: 'Format nomor WhatsApp / HP tidak valid.' });
      return;
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const cleanUsername = rawUsername.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (cleanUsername.length < 3) {
      res.status(400).json({ error: 'Username minimal 3 karakter huruf/angka.' });
      return;
    }

    const db = loadDb();
    const exists = db.users.some(
      (u) => u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === email,
    );
    if (exists) {
      res.status(409).json({ error: 'Username atau email sudah terdaftar.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: `user-${Date.now()}`,
      fullName,
      username: cleanUsername,
      email,
      phone,
      address,
      role: 'user' as const,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDb(db);

    appendAuditLog(
      'REGISTER',
      `Pengguna baru ${newUser.username} (${newUser.fullName}) berhasil mendaftar.`,
      newUser.username,
      clientIp,
      extractUserAgent(req),
    );

    const token = signToken({
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('tm_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureRequest(req),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ token, user: toPublicUser(newUser) });
  });

  app.post('/api/auth/login', async (req: AuthedRequest, res) => {
    const clientIp = extractClientIp(req);
    const rateStatus = getLoginRateStatus(clientIp);
    if (rateStatus.blocked) {
      res.setHeader('Retry-After', String(rateStatus.retryAfterSec));
      res.status(429).json({
        error: `Terlalu banyak percobaan login gagal. Coba kembali dalam ${rateStatus.retryAfterSec} detik.`,
      });
      return;
    }

    const body = req.body as { identifier?: unknown; password?: unknown };
    const identifier = sanitizeText(body.identifier, 120);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email dan password wajib diisi.' });
      return;
    }

    const db = loadDb();
    const normalized = identifier.toLowerCase();
    const user = db.users.find(
      (u) => u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized,
    );

    if (!user) {
      const fails = recordLoginFailure(clientIp);
      appendAuditLog(
        fails >= MAX_LOGIN_FAILURES ? 'RATE_LIMIT_TRIGGERED' : 'LOGIN_FAILED',
        fails >= MAX_LOGIN_FAILURES
          ? `Rate limiter aktif untuk IP ${clientIp} setelah ${fails}x gagal login.`
          : `Percobaan login gagal untuk akun '${identifier}'.`,
        identifier,
        clientIp,
        extractUserAgent(req),
      );
      res.status(401).json({ error: 'Username/email atau password tidak sesuai.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const fails = recordLoginFailure(clientIp);
      appendAuditLog(
        fails >= MAX_LOGIN_FAILURES ? 'RATE_LIMIT_TRIGGERED' : 'LOGIN_FAILED',
        fails >= MAX_LOGIN_FAILURES
          ? `Rate limiter aktif untuk IP ${clientIp} (percobaan pada akun ${user.username}).`
          : `Password salah untuk pengguna ${user.username}.`,
        user.username,
        clientIp,
        extractUserAgent(req),
      );
      res.status(401).json({ error: 'Username/email atau password tidak sesuai.' });
      return;
    }

    clearLoginFailures(clientIp);

    appendAuditLog(
      'LOGIN_SUCCESS',
      `Pengguna ${user.username} (${user.role}) berhasil login.`,
      user.username,
      clientIp,
      extractUserAgent(req),
    );

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('tm_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureRequest(req),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/logout', (req: AuthedRequest, res) => {
    if (req.authUser) {
      appendAuditLog(
        'LOGOUT',
        `Pengguna ${req.authUser.username} telah logout.`,
        req.authUser.username,
        extractClientIp(req),
        extractUserAgent(req),
      );
    }
    res.clearCookie('tm_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureRequest(req),
    });
    res.json({ ok: true });
  });

  // --- Categories ---
  app.get('/api/categories', (_req, res) => {
    const db = loadDb();
    const list = db.categories.map((cat) => ({
      ...cat,
      productCount: db.products.filter((p) => p.categoryId === cat.id).length,
    }));
    res.json({ categories: list });
  });

  app.post('/api/categories', requireAdmin, (req: AuthedRequest, res) => {
    const body = req.body as { name?: unknown; description?: unknown };
    const name = sanitizeText(body.name, 80);
    const description = sanitizeText(body.description, 300);

    if (!name) {
      res.status(400).json({ error: 'Nama kategori wajib diisi.' });
      return;
    }
    const db = loadDb();
    const baseSlug = slugify(name);
    if (!baseSlug) {
      res.status(400).json({ error: 'Nama kategori tidak valid.' });
      return;
    }
    const slugExists = db.categories.some((c) => c.slug === baseSlug);
    const slug = slugExists ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

    const category = {
      id: `cat-${Date.now()}`,
      name,
      slug,
      description,
    };
    db.categories.push(category);
    saveDb(db);

    appendAuditLog(
      'CATEGORY_CREATED',
      `Admin ${req.authUser!.username} menambahkan kategori '${category.name}'.`,
      req.authUser!.username,
      extractClientIp(req),
      extractUserAgent(req),
    );

    res.status(201).json({ category: { ...category, productCount: 0 } });
  });

  app.delete('/api/categories/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDb();
    const idx = db.categories.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Kategori tidak ditemukan.' });
      return;
    }
    const usedCount = db.products.filter((p) => p.categoryId === req.params.id).length;
    if (usedCount > 0) {
      res.status(400).json({ error: 'Kategori masih dipakai oleh produk aktif.' });
      return;
    }
    const [removed] = db.categories.splice(idx, 1);
    saveDb(db);

    appendAuditLog(
      'CATEGORY_DELETED',
      `Admin ${req.authUser!.username} menghapus kategori '${removed.name}'.`,
      req.authUser!.username,
      extractClientIp(req),
      extractUserAgent(req),
    );
    res.json({ ok: true });
  });

  // --- Products ---
  app.get('/api/products', (req: AuthedRequest, res) => {
    const db = loadDb();
    const search = sanitizeText(req.query.search, 100).toLowerCase();
    const categoryId = sanitizeText(req.query.categoryId, 60);
    const includeInactive = req.query.includeInactive === 'true' && req.authUser?.role === 'admin';

    const items = db.products
      .filter((p) => (includeInactive ? true : p.isActive))
      .filter((p) => (!categoryId || categoryId === 'all' ? true : p.categoryId === categoryId))
      .filter((p) =>
        !search
          ? true
          : p.name.toLowerCase().includes(search) ||
            p.description.toLowerCase().includes(search) ||
            findCategoryName(db, p.categoryId).toLowerCase().includes(search),
      )
      .map((p) => ({
        ...p,
        categoryName: findCategoryName(db, p.categoryId),
      }));

    res.json({ products: items });
  });

  app.post('/api/products', requireAdmin, (req: AuthedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const name = sanitizeText(body.name, 120);
    const categoryId = sanitizeText(body.categoryId, 60);
    const description = sanitizeText(body.description, 1000);
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const isActive = body.isActive !== false;

    if (!name || !categoryId) {
      res.status(400).json({ error: 'Nama produk dan kategori wajib diisi.' });
      return;
    }
    if (!isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'Format gambar tidak diizinkan (gunakan JPG, PNG, atau WEBP).' });
      return;
    }

    const numPrice = Number(body.price);
    const numStock = Number(body.stock);
    const numWeight = Number(body.weightGrams);
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      res.status(400).json({ error: 'Harga jual harus lebih dari 0.' });
      return;
    }
    if (!Number.isFinite(numStock) || numStock < 0) {
      res.status(400).json({ error: 'Jumlah stok tidak valid.' });
      return;
    }
    if (!Number.isFinite(numWeight) || numWeight <= 0) {
      res.status(400).json({ error: 'Estimasi bobot harus lebih dari 0 gram.' });
      return;
    }

    const db = loadDb();
    const cat = db.categories.find((c) => c.id === categoryId);
    if (!cat) {
      res.status(400).json({ error: 'Kategori produk tidak valid.' });
      return;
    }

    const product = {
      id: `prod-${Date.now()}`,
      name,
      categoryId,
      price: Math.round(numPrice),
      stock: Math.round(numStock),
      weightGrams: Math.round(numWeight),
      imageUrl: imageUrl || '/src/assets/images/product_keripik_olahan_1794898917432.jpg',
      description,
      isActive,
      createdAt: new Date().toISOString(),
    };

    db.products.unshift(product);
    saveDb(db);

    appendAuditLog(
      'PRODUCT_CREATED',
      `Admin ${req.authUser!.username} menambahkan produk '${product.name}' (${formatRpSimple(product.price)}).`,
      req.authUser!.username,
      extractClientIp(req),
      extractUserAgent(req),
    );

    res.status(201).json({
      product: { ...product, categoryName: cat.name },
    });
  });

  app.put('/api/products/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDb();
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (body.name !== undefined) {
      const cleanName = sanitizeText(body.name, 120);
      if (cleanName) product.name = cleanName;
    }
    if (body.categoryId !== undefined) {
      const catId = sanitizeText(body.categoryId, 60);
      const cat = db.categories.find((c) => c.id === catId);
      if (!cat) {
        res.status(400).json({ error: 'Kategori tidak ditemukan.' });
        return;
      }
      product.categoryId = catId;
    }
    if (body.price !== undefined && Number(body.price) > 0) {
      product.price = Math.round(Number(body.price));
    }
    if (body.stock !== undefined && Number(body.stock) >= 0) {
      product.stock = Math.round(Number(body.stock));
    }
    if (body.weightGrams !== undefined && Number(body.weightGrams) > 0) {
      product.weightGrams = Math.round(Number(body.weightGrams));
    }
    if (body.imageUrl !== undefined) {
      const img = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
      if (!isSafeImageUrl(img)) {
        res.status(400).json({ error: 'Format gambar tidak diizinkan.' });
        return;
      }
      if (img) product.imageUrl = img;
    }
    if (body.description !== undefined) {
      product.description = sanitizeText(body.description, 1000);
    }
    if (typeof body.isActive === 'boolean') {
      product.isActive = body.isActive;
    }

    saveDb(db);

    appendAuditLog(
      'PRODUCT_UPDATED',
      `Admin ${req.authUser!.username} memperbarui data produk '${product.name}'.`,
      req.authUser!.username,
      extractClientIp(req),
      extractUserAgent(req),
    );

    res.json({
      product: { ...product, categoryName: findCategoryName(db, product.categoryId) },
    });
  });

  app.delete('/api/products/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDb();
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Produk tidak ditemukan.' });
      return;
    }
    const [removed] = db.products.splice(idx, 1);
    saveDb(db);

    appendAuditLog(
      'PRODUCT_DELETED',
      `Admin ${req.authUser!.username} menghapus produk '${removed.name}'.`,
      req.authUser!.username,
      extractClientIp(req),
      extractUserAgent(req),
    );

    res.json({ ok: true });
  });

  // --- Orders (IDOR Protected) ---
  app.get('/api/orders', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const search = sanitizeText(req.query.search, 100).toLowerCase();
    const status = sanitizeText(req.query.status, 40);

    let list = db.orders;
    if (req.authUser!.role !== 'admin') {
      list = list.filter((o) => o.userId === req.authUser!.id);
    }
    if (status && status !== 'all') {
      list = list.filter((o) => o.status === status);
    }
    if (search) {
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(search) ||
          o.customerName.toLowerCase().includes(search) ||
          o.customerPhone.toLowerCase().includes(search),
      );
    }

    res.json({ orders: list });
  });

  app.get('/api/orders/:id', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    if (req.authUser!.role !== 'admin' && order.userId !== req.authUser!.id) {
      res.status(403).json({ error: 'Akses ditolak (Proteksi IDOR aktif).' });
      return;
    }
    res.json({ order });
  });

  app.post('/api/orders', requireAuth, (req: AuthedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    const customerName = sanitizeText(body.customerName, 100);
    const customerPhone = sanitizeText(body.customerPhone, 25);
    const shippingAddress = sanitizeText(body.shippingAddress, 300);
    const notes = sanitizeText(body.notes, 250);
    const paymentMethod = body.paymentMethod;
    const items = body.items as Array<{ productId?: unknown; quantity?: unknown }> | undefined;

    if (!customerName || !customerPhone || !shippingAddress) {
      res.status(400).json({ error: 'Nama penerima, nomor HP/WhatsApp, dan alamat wajib diisi.' });
      return;
    }
    if (!isValidPhone(customerPhone)) {
      res.status(400).json({ error: 'Format nomor WhatsApp / HP tidak valid.' });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Keranjang belanja masih kosong.' });
      return;
    }

    const db = loadDb();
    const resolvedItems: OrderItem[] = [];
    let totalAmount = 0;
    let totalWeightGrams = 0;

    for (const reqItem of items) {
      const productId = sanitizeText(reqItem.productId, 60);
      const qty = Math.max(1, Math.min(1000, Math.round(Number(reqItem.quantity) || 0)));
      const prod = db.products.find((p) => p.id === productId && p.isActive);
      if (!prod) {
        res.status(400).json({ error: 'Salah satu produk tidak ditemukan atau nonaktif.' });
        return;
      }
      if (prod.stock < qty) {
        res.status(400).json({
          error: `Stok '${prod.name}' tidak mencukupi (tersisa ${prod.stock} unit).`,
        });
        return;
      }
      resolvedItems.push({
        productId: prod.id,
        productName: prod.name,
        price: prod.price,
        quantity: qty,
        weightGrams: prod.weightGrams,
        imageUrl: prod.imageUrl,
      });
      totalAmount += prod.price * qty;
      totalWeightGrams += prod.weightGrams * qty;
    }

    for (const resolved of resolvedItems) {
      const prod = db.products.find((p) => p.id === resolved.productId);
      if (prod) prod.stock -= resolved.quantity;
    }

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderNumber = `ORD-${dateStamp}-${suffix}`;
    const chosenMethod: PaymentMethod = paymentMethod === 'COD' ? 'COD' : 'TRANSFER BANK';
    const initialStatus: OrderStatus = chosenMethod === 'COD' ? 'Diproses' : 'Menunggu Bayar';

    const shippingFee = 10000;
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      userId: req.authUser!.id,
      customerName,
      customerPhone,
      shippingAddress,
      paymentMethod: chosenMethod,
      notes,
      items: resolvedItems,
      totalWeightGrams,
      shippingFee,
      totalAmount: totalAmount + shippingFee,
      status: initialStatus,
      paymentProofUrl: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    db.orders.unshift(newOrder);
    saveDb(db);

    appendAuditLog(
      'ORDER_CREATED',
      `Pesanan baru ${newOrder.orderNumber} dibuat oleh user ${req.authUser!.username} sebesar ${formatRpSimple(newOrder.totalAmount)}`,
      req.authUser!.username,
      extractClientIp(req),
      extractUserAgent(req),
    );

    res.status(201).json({ order: newOrder });
  });

  app.post('/api/orders/:id/payment-proof', requireAuth, (req: AuthedRequest, res) => {
    const paymentProofUrl =
      typeof (req.body as { paymentProofUrl?: unknown }).paymentProofUrl === 'string'
        ? (req.body as { paymentProofUrl: string }).paymentProofUrl.trim()
        : '';

    if (!paymentProofUrl) {
      res.status(400).json({ error: 'Berkas bukti pembayaran wajib dipilih.' });
      return;
    }
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(paymentProofUrl)) {
      res.status(400).json({ error: 'Format bukti pembayaran wajib gambar JPG, PNG, atau WEBP.' });
      return;
    }

    const db = loadDb();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    if (req.authUser!.role !== 'admin' && order.userId !== req.authUser!.id) {
      res.status(403).json({ error: 'Tidak memiliki akses ke pesanan ini.' });
      return;
    }

    order.paymentProofUrl = paymentProofUrl;
    if (order.status === 'Menunggu Bayar') {
      order.status = 'Diproses';
    }
    order.updatedAt = new Date().toISOString();
    saveDb(db);

    appendAuditLog(
      'PAYMENT_PROOF_UPLOADED',
      `User ${req.authUser!.username} mengunggah bukti bayar untuk pesanan ${order.orderNumber}`,
      req.authUser!.username,
      extractClientIp(req),
      extractUserAgent(req),
    );

    res.json({ order });
  });

  app.patch('/api/orders/:id/status', requireAdmin, (req: AuthedRequest, res) => {
    const { status } = req.body as { status?: OrderStatus };
    const allowed: OrderStatus[] = [
      'Menunggu Bayar',
      'Diproses',
      'Dikirim',
      'Selesai',
      'Dibatalkan',
    ];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ error: 'Status pesanan tidak valid.' });
      return;
    }

    const db = loadDb();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }

    const prevStatus = order.status;
    if (prevStatus !== 'Dibatalkan' && status === 'Dibatalkan') {
      for (const item of order.items) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod) prod.stock += item.quantity;
      }
    } else if (prevStatus === 'Dibatalkan' && status !== 'Dibatalkan') {
      for (const item of order.items) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod && prod.stock >= item.quantity) prod.stock -= item.quantity;
      }
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    saveDb(db);

    appendAuditLog(
      'ORDER_STATUS_UPDATED',
      `Admin ${req.authUser!.username} memperbarui status pesanan ${order.orderNumber} menjadi '${status}'`,
      req.authUser!.username,
      extractClientIp(req),
      extractUserAgent(req),
    );

    res.json({ order });
  });

  // --- Admin Dashboard, Reports & Audit Logs ---
  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const db = loadDb();
    const validOrders = db.orders.filter((o) => o.status !== 'Dibatalkan');
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = db.orders.length;
    const pendingPaymentOrders = db.orders.filter((o) => o.status === 'Menunggu Bayar').length;
    const completedOrders = db.orders.filter((o) => o.status === 'Selesai').length;
    const averageOrderValue =
      validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

    const summary: DashboardSummary = {
      totalRevenue,
      totalOrders,
      pendingPaymentOrders,
      completedOrders,
      averageOrderValue,
      activeProductsCount: db.products.filter((p) => p.isActive).length,
      registeredBuyersCount: db.users.filter((u) => u.role === 'user').length,
      recentOrders: db.orders.slice(0, 6),
      recentLogs: db.auditLogs.slice(0, 6),
      topCommodities: computeTopCommodities(db.orders),
    };

    res.json(summary);
  });

  app.get('/api/admin/reports', requireAdmin, (req, res) => {
    const db = loadDb();
    const startDate = sanitizeText(req.query.startDate, 20);
    const endDate = sanitizeText(req.query.endDate, 20);
    const status = sanitizeText(req.query.status, 40);

    const filtered = db.orders.filter((order) => {
      const orderDay = order.createdAt.slice(0, 10);
      if (startDate && orderDay < startDate) return false;
      if (endDate && orderDay > endDate) return false;
      if (status && status !== 'all' && order.status !== status) return false;
      return true;
    });

    const validOrders = filtered.filter((o) => o.status !== 'Dibatalkan');
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const completedOrders = filtered.filter((o) => o.status === 'Selesai').length;
    const averageOrderValue =
      validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

    res.json({
      orders: filtered,
      metrics: {
        totalRevenue,
        totalOrders: filtered.length,
        completedOrders,
        averageOrderValue,
      },
      topCommodities: computeTopCommodities(filtered),
    });
  });

  app.get('/api/admin/reports/csv', requireAdmin, (req, res) => {
    const db = loadDb();
    const startDate = sanitizeText(req.query.startDate, 20);
    const endDate = sanitizeText(req.query.endDate, 20);
    const status = sanitizeText(req.query.status, 40);

    const filtered = db.orders.filter((order) => {
      const orderDay = order.createdAt.slice(0, 10);
      if (startDate && orderDay < startDate) return false;
      if (endDate && orderDay > endDate) return false;
      if (status && status !== 'all' && order.status !== status) return false;
      return true;
    });

    // Prevent CSV formula injection (=, +, -, @)
    const csvSafe = (val: string) => {
      const escaped = val.replace(/"/g, '""');
      const guarded = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
      return `"${guarded}"`;
    };

    const header = [
      'No Pesanan',
      'Tanggal',
      'Penerima',
      'Kontak',
      'Metode Bayar',
      'Total Tagihan (Rp)',
      'Status',
    ];
    const rows = filtered.map((o) => [
      csvSafe(o.orderNumber),
      csvSafe(o.createdAt),
      csvSafe(o.customerName),
      csvSafe(o.customerPhone),
      csvSafe(o.paymentMethod),
      String(o.totalAmount),
      csvSafe(o.status),
    ]);
    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="laporan-penjualan-tangkolomart.csv"');
    res.send(csvContent);
  });

  app.get('/api/admin/audit-logs', requireAdmin, (req, res) => {
    const db = loadDb();
    const search = sanitizeText(req.query.search, 100).toLowerCase();
    const event = sanitizeText(req.query.event, 40) as AuditEvent | 'all' | '';

    const logs = db.auditLogs.filter((log) => {
      if (event && event !== 'all' && log.event !== event) return false;
      if (search) {
        return (
          log.description.toLowerCase().includes(search) ||
          log.username.toLowerCase().includes(search) ||
          log.ipAddress.toLowerCase().includes(search) ||
          log.event.toLowerCase().includes(search)
        );
      }
      return true;
    });

    res.json({ logs });
  });

  return app;
}
