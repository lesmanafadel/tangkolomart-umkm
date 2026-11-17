# TangkoloMart — Pasar Digital Komoditas & UMKM Desa Tangkolo

Aplikasi web *full-stack* e-commerce dan manajemen operasional **BUMDes Karya Mandiri Desa Tangkolo** yang dirancang dengan prinsip *secure coding* untuk memenuhi **Tugas Project Mata Kuliah Cyber Security**.

> **Identitas Mahasiswa**
> - **Nama:** [Isi Nama Lengkap Anda]
> - **NIM:** [Isi NIM Anda]
> - **Kelas:** [Isi Kelas Anda]
> - **URL Aplikasi Live:** `https://[nama-proyek-anda].vercel.app` *(perbarui setelah deploy ke Vercel)*

---

## 1. Deskripsi Aplikasi

**TangkoloMart** menghubungkan petani, kelompok wanita tani (KWT), dan pengrajin lokal Desa Tangkolo dengan warga maupun pembeli luar daerah. Sistem terdiri dari dua bagian utama:
1. **Etalase Warga / Pembeli (`TangkoloMart`)**: Pencarian produk, filter kategori, halaman detail produk, keranjang belanja, checkout (Transfer Bank BJB/BRI & COD), pelacakan status pesanan, cetak bukti transaksi, dan unggah bukti pembayaran.
2. **Panel Pengelola BUMDes (`TangkoloAdmin`)**: Dashboard KPI omset, pengelolaan produk UMKM (CRUD), pengelolaan kategori (CRUD), pengelolaan pesanan masuk, laporan rekapitulasi penjualan (ekspor CSV & cetak PDF), serta **Audit Log Keamanan**.

### Akun Uji Coba (Demo)
| Peran | Username | Password | Hak Akses |
| :--- | :--- | :--- | :--- |
| **Admin BUMDes** | `admin` | `admin123` | Dashboard, CRUD Produk & Kategori, Kelola Pesanan, Laporan, Audit Log, Reset DB |
| **Warga / Pembeli** | `warga` | `warga123` | Belanja produk, Checkout, Unggah Bukti Bayar, Riwayat Pesanan Pribadi |

---

## 2. Teknologi yang Digunakan

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
- **Backend:** Node.js 22+, Express 4 (berjalan sebagai server lokal maupun *Vercel Serverless Function* di `/api`)
- **Keamanan & Kriptografi:** `bcryptjs` (password hashing), `crypto` HMAC-SHA256 (signed session token), HTTP Security Headers, Rate Limiter, CSRF Origin Guard, Input Sanitization
- **Penyimpanan Data:** JSON Persisted Store (`data/tangkolomart.db.json` di lokal, `/tmp/tangkolomart-data` di Vercel Serverless)
- **Hosting:** Vercel (HTTPS/SSL otomatis)

---

## 3. Cara Instalasi & Menjalankan Secara Lokal

### Prasyarat
- **Node.js v22.18+** dan **npm**

### Langkah Instalasi
1. **Clone repository:**
   ```bash
   git clone https://github.com/USERNAME/tangkolomart-umkm.git
   cd tangkolomart-umkm
   ```
2. **Pasang dependensi:**
   ```bash
   npm install
   ```
3. **Konfigurasi Environment Variables:**
   Salin `.env.example` menjadi `.env` dan isi nilainya (jangan pernah commit `.env` ke Git):
   ```env
   SESSION_SECRET="ganti_dengan_string_acak_minimal_32_karakter"
   PORT=3000
   ```
4. **Jalankan mode pengembangan (development):**
   ```bash
   npm run dev
   ```
   Akses di browser pada `http://localhost:3000`.
5. **Build & jalankan mode produksi:**
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

---

## 4. Penerapan Keamanan Aplikasi

1. **Password Hashing (`bcryptjs`)**: Seluruh password di-hash dengan Bcrypt (*salt rounds = 10*), tidak ada password plaintext yang tersimpan.
2. **Kebijakan Password Kuat**: Registrasi menolak password di bawah 8 karakter, password umum (`12345678`, `password`, dll.), serta mewajibkan kombinasi huruf besar, huruf kecil, dan angka.
3. **Validasi & Sanitasi Input (Anti-XSS & Anti-Injection)**: Semua input teks dibersihkan melalui `sanitizeText()` (menghapus tag HTML `<...>`, karakter kontrol, dan pembatasan panjang). Upload gambar & bukti bayar dibatasi hanya tipe `image/jpeg`, `image/png`, `image/webp`. Ekspor CSV dilindungi dari *CSV Formula Injection*.
4. **Manajemen Sesi & Cookie Aman**: Token sesi ditandatangani menggunakan **HMAC-SHA256** (`crypto.timingSafeEqual`) dengan masa berlaku 7 hari, dikirim lewat cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` (di lingkungan HTTPS/produksi).
5. **Kontrol Akses Berbasis Peran (RBAC) & Anti-IDOR**:
   - Seluruh endpoint `/api/admin/*`, CRUD produk/kategori, update status order, dan `/api/db/reset` dilindungi `requireAdmin`.
   - Endpoint pesanan (`/api/orders`, `/api/orders/:id`, unggah bukti bayar) memverifikasi kepemilikan (`order.userId === authUser.id`) untuk mencegah IDOR.
6. **Rate Limiting Brute-Force Login**: Maksimal 5 percobaan login gagal per IP dalam 5 menit; percobaan ke-6 diblokir dengan **HTTP 429 Too Many Requests** dan dicatat ke Audit Log (`RATE_LIMIT_TRIGGERED`).
7. **Proteksi CSRF & HTTP Security Headers**: Validasi `Origin` pada mutating requests serta header `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, dan `Permissions-Policy`.
8. **Audit Log Keamanan**: Mencatat kejadian autentikasi, kegagalan login, rate limiting, pembuatan pesanan, dan perubahan data lengkap dengan timestamp, username, IP, dan User-Agent.

---

## 5. Hasil Self-Testing Keamanan

Pengujian dilakukan langsung terhadap endpoint backend menggunakan `curl` dan `npm audit`:

| No | Skenario Uji | Cara Pengujian | Hasil | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **HTTP Security Headers** | `curl -sI http://localhost:3000/api/health` | Header `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `CSP`, `HSTS`, `Referrer-Policy` aktif | **Lolos** |
| 2 | **SQL Injection pada Form Login** | Mengirim payload `' OR '1'='1` pada username & password ke `/api/auth/login` | Ditolak dengan `HTTP 401` (*Username/email atau password tidak sesuai*) | **Lolos** |
| 3 | **Penolakan Password Lemah** | Registrasi dengan password `12345678` ke `/api/auth/register` | Ditolak dengan `HTTP 400` (*Password terlalu umum dan lemah*) | **Lolos** |
| 4 | **Sanitasi XSS pada Input** | Registrasi dengan `fullName: "<script>alert(1)</script>Sari Dewi"` | Tag `<script>` dihapus oleh sanitizer server menjadi `alert(1)Sari Dewi` | **Lolos** |
| 5 | **Kontrol Akses Admin (RBAC)** | User biasa mengakses `GET /api/admin/dashboard` & `POST /api/db/reset` | Ditolak dengan `HTTP 403 Forbidden` | **Lolos** |
| 6 | **Proteksi IDOR pada Pesanan** | User baru (`saridewi`) mencoba mengakses `GET /api/orders/ord-4` milik `warga` | Ditolak dengan `HTTP 403` (*Akses ditolak - Proteksi IDOR aktif*) | **Lolos** |
| 7 | **Rate Limiting Brute-Force** | Mengirim 6x login gagal berturut-turut dari IP yang sama ke `/api/auth/login` | Percobaan ke-1..5 `HTTP 401`, percobaan ke-6 diblokir `HTTP 429` & tercatat di Audit Log | **Lolos** |
| 8 | **Audit Kerentanan Dependensi** | Menjalankan `npm audit --omit=dev` | `found 0 vulnerabilities` pada 189 paket produksi | **Lolos** |

---

## 6. Penggunaan AI Agent

- **Alat AI yang Dipakai:** AI Coding Assistant (Google AI Studio / Gemini)
- **Bagian yang Dibantu:** Perancangan arsitektur Express + React, implementasi modul autentikasi Bcrypt & HMAC token, CRUD produk/kategori/pesanan, halaman laporan & audit log, konfigurasi deployment Vercel, serta penyusunan skenario *self-testing* keamanan.
- **Contoh Prompt Utama:**
  - *"Buatkan aplikasi web e-commerce UMKM Desa Tangkolo (TangkoloMart) dengan halaman storefront warga dan panel admin pengelola BUMDes."*
  - *"Siapkan konfigurasi hosting ke Vercel beserta pengamanan sesuai standar keamanan aplikasi web (Bcrypt, RBAC, IDOR protection, rate limiting, security headers, sanitasi input)."*
- **Peninjauan & Verifikasi Mandiri:** Seluruh kode autentikasi (`server/app.ts`), penyimpanan hash Bcrypt (`server/db.ts`), header keamanan (`vercel.json`), serta 8 skenario *self-testing* diverifikasi ulang melalui `tsc --noEmit`, `vite build`, pengujian `curl`, dan `npm audit`.
