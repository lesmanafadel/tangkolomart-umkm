import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import type {
  AuditEvent,
  AuditLog,
  Category,
  Order,
  Product,
  PublicUser,
  UserRole,
} from '../src/types.ts';

export interface StoredUser extends PublicUser {
  passwordHash: string;
}

export interface DatabaseState {
  meta: {
    seededAt: string;
    lastUpdatedAt: string;
  };
  categories: Category[];
  products: Product[];
  users: StoredUser[];
  orders: Order[];
  auditLogs: AuditLog[];
}

const DATA_DIR = process.env.VERCEL
  ? '/tmp/tangkolomart-data'
  : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'tangkolomart.db.json');

const IMG_KOPI = '/src/assets/images/product_kopi_robusta_1794898916410.jpg';
const IMG_MADU = '/src/assets/images/product_madu_hutan_1794898917897.jpg';
const IMG_GULA = '/src/assets/images/product_gula_aren_1794898916938.jpg';
const IMG_KERIPIK = '/src/assets/images/product_keripik_olahan_1794898917432.jpg';
const IMG_BERAS = '/src/assets/images/product_beras_organik_1794898916696.jpg';
const IMG_BAMBU = '/src/assets/images/product_anyaman_bambu_1794898917922.jpg';

function createInitialSeed(): DatabaseState {
  const now = new Date().toISOString();
  const adminHash = bcrypt.hashSync('admin123', 10);
  const wargaHash = bcrypt.hashSync('warga123', 10);

  const categories: Category[] = [
    {
      id: 'cat-1',
      name: 'Kopi & Minuman Tradisional',
      slug: 'kopi-minuman-tradisional',
      description: 'Kopi biji dan bubuk asli petik merah lereng perbukitan Desa Tangkolo serta herbal tradisional.',
    },
    {
      id: 'cat-2',
      name: 'Gula Aren & Madu Hutan',
      slug: 'gula-aren-madu-hutan',
      description: 'Gula aren organik hasil sadapan pohon kawung lokal dan madu hutan murni lebah liar.',
    },
    {
      id: 'cat-3',
      name: 'Camilan & Olahan Tani',
      slug: 'camilan-olahan-tani',
      description: 'Keripik singkong, pisang sale, dan aneka olahan pangan UMKM kelompok ibu-ibu PKK.',
    },
    {
      id: 'cat-4',
      name: 'Beras Organik & Palawija',
      slug: 'beras-organik-palawija',
      description: 'Beras merah, beras pandan wangi pulen, dan hasil palawija langsung dari kelompok tani.',
    },
    {
      id: 'cat-5',
      name: 'Kerajinan Anyaman Bambu',
      slug: 'kerajinan-anyaman-bambu',
      description: 'Kerajinan tangan anyaman bambu khas Tangkolo seperti besek hajatan, tudung saji, dan tas.',
    },
  ];

  const products: Product[] = [
    {
      id: 'prod-1',
      name: 'Tas Keranjang Anyaman Bambu Eksklusif',
      categoryId: 'cat-5',
      price: 65000,
      stock: 20,
      weightGrams: 600,
      imageUrl: IMG_BAMBU,
      description: 'Tas keranjang belanja dan hampers anyaman bambu halus karya pengrajin senior Desa Tangkolo dengan pegangan bambu bakar yang kokoh dan tahan lama.',
      isActive: true,
      createdAt: '2026-11-10T08:00:00.000Z',
    },
    {
      id: 'prod-2',
      name: 'Besek Bambu Tradisional Tangkolo (Set isi 5)',
      categoryId: 'cat-5',
      price: 25000,
      stock: 80,
      weightGrams: 400,
      imageUrl: IMG_BAMBU,
      description: 'Set isi 5 pasang besek bambu alami tanpa bahan pemutih, higienis untuk kemasan makanan kenduri, oleh-oleh, dan hampers ramah lingkungan.',
      isActive: true,
      createdAt: '2026-11-10T08:10:00.000Z',
    },
    {
      id: 'prod-3',
      name: 'Beras Organik Pandan Wangi Tangkolo 5 Kg',
      categoryId: 'cat-4',
      price: 78000,
      stock: 34,
      weightGrams: 5000,
      imageUrl: IMG_BERAS,
      description: 'Beras putih varietas Pandan Wangi budidaya organik bebas pestisida dari sawah terasering Desa Tangkolo. Pulen, harum alami, dan bergizi tinggi.',
      isActive: true,
      createdAt: '2026-11-10T08:20:00.000Z',
    },
    {
      id: 'prod-4',
      name: 'Keripik Singkong Balado Daun Jeruk 200gr',
      categoryId: 'cat-3',
      price: 15000,
      stock: 53,
      weightGrams: 200,
      imageUrl: IMG_KERIPIK,
      description: 'Olahan singkong mentega renyah dibalut bumbu cabai balado asli dan irisan daun jeruk purut segar produksi KWT Maju Jaya Tangkolo.',
      isActive: true,
      createdAt: '2026-11-10T08:30:00.000Z',
    },
    {
      id: 'prod-5',
      name: 'Keripik Pisang Tanduk Renyah Tangkolo 250gr',
      categoryId: 'cat-3',
      price: 18000,
      stock: 50,
      weightGrams: 250,
      imageUrl: IMG_KERIPIK,
      description: 'Irisan tipis pisang tanduk pilihan digoreng dengan minyak kelapa murni, menghasilkan rasa gurih manis alami tanpa pemanis buatan.',
      isActive: true,
      createdAt: '2026-11-10T08:40:00.000Z',
    },
    {
      id: 'prod-6',
      name: 'Madu Hutan Murni Tangkolo 350ml',
      categoryId: 'cat-2',
      price: 85000,
      stock: 25,
      weightGrams: 500,
      imageUrl: IMG_MADU,
      description: 'Madu mentah (raw honey) dipanen lestari dari lebah hutan liar Apis dorsata di kawasan hutan lindung sekitar Desa Tangkolo.',
      isActive: true,
      createdAt: '2026-11-10T08:50:00.000Z',
    },
    {
      id: 'prod-7',
      name: 'Gula Semut Aren Tangkolo Organik 500gr',
      categoryId: 'cat-2',
      price: 28000,
      stock: 40,
      weightGrams: 500,
      imageUrl: IMG_GULA,
      description: 'Gula aren kristal (gula semut) kadar air rendah dengan indeks glikemik bersahabat, cocok sebagai pemanis kopi, teh, dan bahan kue.',
      isActive: true,
      createdAt: '2026-11-10T09:00:00.000Z',
    },
    {
      id: 'prod-8',
      name: 'Gula Aren Asli Tangkolo Cetak (1 Kg)',
      categoryId: 'cat-2',
      price: 32000,
      stock: 35,
      weightGrams: 1000,
      imageUrl: IMG_GULA,
      description: 'Gula aren cetak batok murni 100% nira pohon kawung tanpa campuran gula pasir atau pengawet sulfit, beraroma karamel khas.',
      isActive: true,
      createdAt: '2026-11-10T09:10:00.000Z',
    },
    {
      id: 'prod-9',
      name: 'Kopi Robusta Tangkolo Petik Merah 250gr',
      categoryId: 'cat-1',
      price: 38000,
      stock: 45,
      weightGrams: 250,
      imageUrl: IMG_KOPI,
      description: 'Biji kopi Robusta dataran tinggi Desa Tangkolo dipetik merah sempurna, diolah natural process dengan profil rasa cokelat hitam dan karamel.',
      isActive: true,
      createdAt: '2026-11-10T09:20:00.000Z',
    },
    {
      id: 'prod-10',
      name: 'Kopi Arabika Tangkolo Specialty 200gr',
      categoryId: 'cat-1',
      price: 55000,
      stock: 30,
      weightGrams: 200,
      imageUrl: IMG_KOPI,
      description: 'Kopi arabika single origin perkebunan rakyat Desa Tangkolo. Memiliki cita rasa fruity segar dengan aroma floral dan aftertaste cokelat manis.',
      isActive: true,
      createdAt: '2026-11-10T09:30:00.000Z',
    },
  ];

  const users: StoredUser[] = [
    {
      id: 'user-admin',
      fullName: 'Administrator BUMDes Tangkolo',
      username: 'admin',
      email: 'admin@tangkolomart.desa.id',
      phone: '081200001111',
      address: 'Kantor BUMDes Karya Mandiri, Desa Tangkolo',
      role: 'admin',
      passwordHash: adminHash,
      createdAt: '2026-11-01T08:00:00.000Z',
    },
    {
      id: 'user-warga',
      fullName: 'Ahmad Fauzi (Warga/Pembeli)',
      username: 'warga',
      email: 'ahmad.fauzi@tangkolomart.desa.id',
      phone: '089876543210',
      address: 'Dusun Kliwon RT 02 RW 01, Desa Tangkolo',
      role: 'user',
      passwordHash: wargaHash,
      createdAt: '2026-11-05T10:15:00.000Z',
    },
  ];

  const orders: Order[] = [
    {
      id: 'ord-4',
      orderNumber: 'ORD-20261117-218472',
      userId: 'user-warga',
      customerName: 'Ahmad Fauzi (Warga/Pembeli)',
      customerPhone: '089876543210',
      shippingAddress: 'Dusun Kliwon RT 02 RW 01, Desa Tangkolo',
      paymentMethod: 'TRANSFER BANK',
      notes: 'Mohon packing rapi pakai kardus tambahan',
      items: [
        {
          productId: 'prod-7',
          productName: 'Gula Semut Aren Tangkolo Organik 500gr',
          price: 28000,
          quantity: 2,
          weightGrams: 500,
          imageUrl: IMG_GULA,
        },
        {
          productId: 'prod-8',
          productName: 'Gula Aren Asli Tangkolo Cetak (1 Kg)',
          price: 32000,
          quantity: 1,
          weightGrams: 1000,
          imageUrl: IMG_GULA,
        },
      ],
      totalWeightGrams: 2000,
      shippingFee: 0,
      totalAmount: 88000,
      status: 'Diproses',
      paymentProofUrl: '',
      createdAt: '2026-11-17T13:06:46.000Z',
      updatedAt: '2026-11-17T13:06:57.000Z',
    },
    {
      id: 'ord-3',
      orderNumber: 'ORD-20261117-E03DDC',
      userId: 'user-warga',
      customerName: 'Ahmad Fauzi (Warga/Pembeli)',
      customerPhone: '089876543210',
      shippingAddress: 'Dusun Kliwon RT 02 RW 01, Desa Tangkolo',
      paymentMethod: 'TRANSFER BANK',
      notes: 'Kirim sore hari',
      items: [
        {
          productId: 'prod-4',
          productName: 'Keripik Singkong Balado Daun Jeruk 200gr',
          price: 15000,
          quantity: 2,
          weightGrams: 200,
          imageUrl: IMG_KERIPIK,
        },
      ],
      totalWeightGrams: 400,
      shippingFee: 10000,
      totalAmount: 40000,
      status: 'Dikirim',
      paymentProofUrl: '',
      createdAt: '2026-11-17T12:43:10.000Z',
      updatedAt: '2026-11-17T13:05:10.000Z',
    },
    {
      id: 'ord-2',
      orderNumber: 'ORD-202611-002',
      userId: 'user-warga',
      customerName: 'Ahmad Fauzi',
      customerPhone: '089876543210',
      shippingAddress: 'Dusun Kliwon RT 02 RW 01, Desa Tangkolo',
      paymentMethod: 'TRANSFER BANK',
      notes: '',
      items: [
        {
          productId: 'prod-6',
          productName: 'Madu Hutan Murni Tangkolo 350ml',
          price: 85000,
          quantity: 1,
          weightGrams: 500,
          imageUrl: IMG_MADU,
        },
        {
          productId: 'prod-9',
          productName: 'Kopi Robusta Tangkolo Petik Merah 250gr',
          price: 38000,
          quantity: 1,
          weightGrams: 250,
          imageUrl: IMG_KOPI,
        },
      ],
      totalWeightGrams: 750,
      shippingFee: 5000,
      totalAmount: 128000,
      status: 'Diproses',
      paymentProofUrl: '',
      createdAt: '2026-11-17T12:02:30.000Z',
      updatedAt: '2026-11-17T12:04:00.000Z',
    },
    {
      id: 'ord-1',
      orderNumber: 'ORD-202611-001',
      userId: 'user-warga',
      customerName: 'Ahmad Fauzi',
      customerPhone: '089876543210',
      shippingAddress: 'Dusun Kliwon RT 02 RW 01, Desa Tangkolo',
      paymentMethod: 'TRANSFER BANK',
      notes: 'Pesanan awal bulan',
      items: [
        {
          productId: 'prod-3',
          productName: 'Beras Organik Pandan Wangi Tangkolo 5 Kg',
          price: 78000,
          quantity: 1,
          weightGrams: 5000,
          imageUrl: IMG_BERAS,
        },
        {
          productId: 'prod-8',
          productName: 'Gula Aren Asli Tangkolo Cetak (1 Kg)',
          price: 32000,
          quantity: 1,
          weightGrams: 1000,
          imageUrl: IMG_GULA,
        },
      ],
      totalWeightGrams: 6000,
      shippingFee: 0,
      totalAmount: 110000,
      status: 'Selesai',
      paymentProofUrl: '',
      createdAt: '2026-11-17T12:02:00.000Z',
      updatedAt: '2026-11-17T12:20:00.000Z',
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'log-9',
      event: 'LOGIN_SUCCESS',
      description: 'Pengguna admin (admin) berhasil login.',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'admin',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:58:16.000Z',
    },
    {
      id: 'log-8',
      event: 'LOGOUT',
      description: 'Pengguna admin telah logout.',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'admin',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:57:29.000Z',
    },
    {
      id: 'log-7',
      event: 'LOGIN_SUCCESS',
      description: 'Pengguna admin (admin) berhasil login.',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'admin',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:07:40.000Z',
    },
    {
      id: 'log-6',
      event: 'LOGOUT',
      description: 'Pengguna warga telah logout.',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'warga',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:07:09.000Z',
    },
    {
      id: 'log-5',
      event: 'PAYMENT_PROOF_UPLOADED',
      description: 'User warga mengunggah bukti bayar untuk pesanan ORD-20261117-218472',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'warga',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:06:57.000Z',
    },
    {
      id: 'log-4',
      event: 'ORDER_CREATED',
      description: 'Pesanan baru ORD-20261117-218472 dibuat oleh user warga sebesar Rp 88.000',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'warga',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:06:46.000Z',
    },
    {
      id: 'log-3',
      event: 'LOGIN_SUCCESS',
      description: 'Pengguna warga (user) berhasil login.',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'warga',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:06:27.000Z',
    },
    {
      id: 'log-2',
      event: 'LOGOUT',
      description: 'Pengguna admin telah logout.',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'admin',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:06:21.000Z',
    },
    {
      id: 'log-1',
      event: 'ORDER_STATUS_UPDATED',
      description: "Admin admin memperbarui status pesanan ORD-20261117-E03DDC menjadi 'Dikirim'",
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      username: 'admin',
      ipAddress: '::1',
      createdAt: '2026-11-17T13:05:10.000Z',
    },
  ];

  return {
    meta: {
      seededAt: now,
      lastUpdatedAt: now,
    },
    categories,
    products,
    users,
    orders,
    auditLogs,
  };
}

let dbState: DatabaseState | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadDb(): DatabaseState {
  if (dbState) {
    return dbState;
  }
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(raw) as DatabaseState;
      return dbState;
    } catch {
      dbState = createInitialSeed();
      saveDb(dbState);
      return dbState;
    }
  }
  dbState = createInitialSeed();
  saveDb(dbState);
  return dbState;
}

export function saveDb(state: DatabaseState): void {
  ensureDataDir();
  state.meta.lastUpdatedAt = new Date().toISOString();
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
  dbState = state;
}

export function resetDb(username: string, ipAddress: string, userAgent: string): DatabaseState {
  const fresh = createInitialSeed();
  fresh.auditLogs.unshift({
    id: `log-${Date.now()}`,
    event: 'DB_RESET',
    description: `Database di-reset ke data awal oleh ${username || 'tamu'}.`,
    userAgent,
    username: username || 'sistem',
    ipAddress,
    createdAt: new Date().toISOString(),
  });
  saveDb(fresh);
  return fresh;
}

export function appendAuditLog(
  event: AuditEvent,
  description: string,
  username: string,
  ipAddress: string,
  userAgent: string,
): AuditLog {
  const db = loadDb();
  const entry: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    event,
    description,
    userAgent: userAgent || 'Unknown',
    username: username || 'anonim',
    ipAddress: ipAddress || '127.0.0.1',
    createdAt: new Date().toISOString(),
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDb(db);
  return entry;
}

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _removed, ...rest } = user;
  void _removed;
  return rest;
}

export function findCategoryName(db: DatabaseState, categoryId: string): string {
  return db.categories.find((c) => c.id === categoryId)?.name ?? 'Lainnya';
}

export function isAdminRole(role?: UserRole): boolean {
  return role === 'admin';
}
