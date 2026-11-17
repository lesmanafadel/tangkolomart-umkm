import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ShoppingCart,
  Leaf,
  User as UserIcon,
  LogOut,
  Plus,
  Minus,
  Trash2,
  X,
  Database,
  RefreshCw,
  Upload,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  ChevronDown,
  Printer,
  ArrowLeft,
} from 'lucide-react';
import {
  apiFetch,
  formatDateTimeShort,
  formatRupiah,
  readFileAsCompressedDataUrl,
} from '../lib/api.ts';
import { ProductImage } from './ProductImage.tsx';
import { OrderStatusBadge } from './StatusBadge.tsx';
import type {
  CartItem,
  Category,
  DbStatusSummary,
  Order,
  PaymentMethod,
  Product,
  PublicUser,
} from '../types.ts';

type StoreView = 'catalog' | 'detail' | 'cart' | 'checkout' | 'orders' | 'order-detail';

interface StorefrontProps {
  user: PublicUser | null;
  categories: Category[];
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product, quantity?: number) => void;
  onUpdateCartQty: (productId: string, quantity: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  onNavigateAuth: (mode: 'login' | 'register') => void;
  onNavigateAdmin: () => void;
  onLogout: () => void;
  onRefreshStore: () => Promise<void>;
}

const SHIPPING_FEE = 10000;

export function Storefront({
  user,
  categories,
  products,
  cart,
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  onClearCart,
  onNavigateAuth,
  onNavigateAdmin,
  onLogout,
  onRefreshStore,
}: StorefrontProps) {
  const [storeView, setStoreView] = useState<StoreView>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [pdpQty, setPdpQty] = useState(1);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bannerAlert, setBannerAlert] = useState('');
  const [dbModalOpen, setDbModalOpen] = useState(false);

  // Cart draft quantities for "Perbarui Jumlah"
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});

  // Checkout state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFER BANK');
  const [orderNotes, setOrderNotes] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Orders & Order Detail state
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);

  // DB Status modal state
  const [dbStatus, setDbStatus] = useState<DbStatusSummary | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbFeedback, setDbFeedback] = useState('');

  useEffect(() => {
    if (user) {
      setCustomerName(user.fullName || '');
      setCustomerPhone(user.phone || '');
      setShippingAddress(user.address || '');
    }
  }, [user]);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const item of cart) {
      next[item.product.id] = item.quantity;
    }
    setDraftQuantities(next);
  }, [cart]);

  function showBanner(msg: string) {
    setBannerAlert(msg);
    setTimeout(() => {
      setBannerAlert((prev) => (prev === msg ? '' : prev));
    }, 4000);
  }

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.categoryName || '').toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, searchQuery]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartWeightGrams = cart.reduce(
    (sum, item) => sum + item.product.weightGrams * item.quantity,
    0,
  );

  function openProductDetail(product: Product) {
    setActiveProduct(product);
    setPdpQty(1);
    setStoreView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleAddAndGoToCart(product: Product, qty: number) {
    onAddToCart(product, qty);
    showBanner(`${product.name} berhasil ditambahkan ke keranjang!`);
    setStoreView('cart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleApplyCartUpdates() {
    for (const item of cart) {
      const nextQty = draftQuantities[item.product.id];
      if (typeof nextQty === 'number' && nextQty !== item.quantity) {
        onUpdateCartQty(item.product.id, Math.min(item.product.stock, Math.max(0, nextQty)));
      }
    }
    showBanner('Jumlah keranjang belanja berhasil diperbarui.');
  }

  async function openMyOrders() {
    if (!user) {
      onNavigateAuth('login');
      return;
    }
    setUserMenuOpen(false);
    setStoreView('orders');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoadingOrders(true);
    try {
      const res = await apiFetch<{ orders: Order[] }>('/api/orders');
      setMyOrders(res.orders);
    } catch {
      setMyOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  function handleGoToCheckout() {
    if (!user) {
      onNavigateAuth('login');
      return;
    }
    setCheckoutError('');
    setStoreView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setCheckoutError('');
    setCheckoutLoading(true);
    try {
      const res = await apiFetch<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          customerPhone,
          shippingAddress,
          paymentMethod,
          notes: orderNotes,
          items: cart.map((c) => ({
            productId: c.product.id,
            quantity: c.quantity,
          })),
        }),
      });
      onClearCart();
      setOrderNotes('');
      await onRefreshStore();
      setSelectedOrder(res.order);
      showBanner(`Pesanan Anda dengan nomor ${res.order.orderNumber} berhasil dibuat!`);
      setStoreView('order-detail');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Gagal membuat pesanan.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleUploadPaymentProof(orderId: string, file: File) {
    setUploadingOrderId(orderId);
    try {
      const dataUrl = await readFileAsCompressedDataUrl(file, 900);
      const res = await apiFetch<{ order: Order }>(`/api/orders/${orderId}/payment-proof`, {
        method: 'POST',
        body: JSON.stringify({ paymentProofUrl: dataUrl }),
      });
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(res.order);
      }
      setMyOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      showBanner('Bukti pembayaran berhasil diunggah. Pesanan sedang diproses oleh BUMDes.');
    } catch (err) {
      showBanner(err instanceof Error ? err.message : 'Gagal mengunggah bukti bayar.');
    } finally {
      setUploadingOrderId(null);
    }
  }

  async function openDbStatusModal() {
    setDbModalOpen(true);
    setDbFeedback('');
    setDbLoading(true);
    try {
      const status = await apiFetch<DbStatusSummary>('/api/db/status');
      setDbStatus(status);
    } catch (err) {
      setDbFeedback(err instanceof Error ? err.message : 'Gagal memuat status DB.');
    } finally {
      setDbLoading(false);
    }
  }

  async function handleResetDatabase() {
    setDbLoading(true);
    setDbFeedback('');
    try {
      await apiFetch('/api/db/reset', { method: 'POST' });
      const status = await apiFetch<DbStatusSummary>('/api/db/status');
      setDbStatus(status);
      await onRefreshStore();
      setDbFeedback('Database berhasil di-reset ke data awal Desa Tangkolo.');
    } catch (err) {
      setDbFeedback(err instanceof Error ? err.message : 'Gagal mereset database.');
    } finally {
      setDbLoading(false);
    }
  }

  const orderSubtotal = (order: Order) =>
    order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Slim Top Announcement Bar */}
      <div className="no-print bg-emerald-950 text-emerald-100 text-xs px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 truncate">
            <span className="font-semibold tracking-wider uppercase text-emerald-300 shrink-0">
              Desa Tangkolo
            </span>
            <span className="text-emerald-500" aria-hidden="true">
              ·
            </span>
            <span className="truncate">
              Belanja Komoditas &amp; Kerajinan Asli Warga Desa Tangkolo · 100% Produk Lokal
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-emerald-200 whitespace-nowrap shrink-0">
            <span>Terenkripsi &amp; Aman</span>
            <span className="text-emerald-600" aria-hidden="true">
              |
            </span>
            <span>BUMDes Tangkolo</span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          {/* Brand */}
          <button
            type="button"
            onClick={() => {
              setStoreView('catalog');
              setBannerAlert('');
            }}
            className="flex items-center gap-3 whitespace-nowrap shrink-0 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-800 flex items-center justify-center text-white shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                TangkoloMart
              </div>
              <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase leading-none mt-0.5">
                UMKM Desa Tangkolo
              </div>
            </div>
          </button>

          {/* Search */}
          <div className="hidden md:block flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (storeView !== 'catalog') setStoreView('catalog');
                }}
                placeholder="Cari kopi, beras, gula aren, madu Tangkolo..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-full bg-slate-100 border border-transparent focus:bg-white focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Nav & User Actions */}
          <nav className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={() => {
                setStoreView('catalog');
                setBannerAlert('');
              }}
              className={`hidden sm:inline-block text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                storeView === 'catalog'
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-700 hover:text-emerald-700'
              }`}
            >
              Katalog
            </button>

            <button
              type="button"
              onClick={() => setStoreView('cart')}
              aria-label="Buka keranjang belanja"
              className="relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-500 bg-white text-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-700" />
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold tabular-nums">
                {cartCount}
              </span>
            </button>

            {user ? (
              <div className="relative flex items-center gap-2.5 shrink-0">
                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={onNavigateAdmin}
                    className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Panel Admin
                  </button>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 max-w-[190px]"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="truncate">{user.fullName}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-40">
                      <button
                        type="button"
                        onClick={openMyOrders}
                        className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <ClipboardList className="w-4 h-4 text-emerald-700" />
                        Pesanan Saya
                      </button>
                      {user.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onNavigateAdmin();
                          }}
                          className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <LayoutDashboard className="w-4 h-4 text-slate-700" />
                          Panel Admin BUMDes
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigateAuth('login')}
                  className="px-3 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateAuth('register')}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Daftar
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* CATALOG VIEW */}
      {storeView === 'catalog' && (
        <>
          <section className="bg-emerald-900 hero-dot-pattern text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
              <div className="max-w-3xl">
                <p className="inline-block text-xs sm:text-sm font-semibold text-emerald-200 bg-emerald-950/60 border border-emerald-700/60 px-3.5 py-1.5 rounded-lg mb-5">
                  BUMDes Karya Mandiri Desa Tangkolo
                </p>
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.12] text-balance">
                  Pasar Digital Komoditas &amp; UMKM{' '}
                  <span className="text-emerald-400">Desa Tangkolo</span>
                </h1>
                <p className="mt-5 text-base sm:text-lg text-emerald-100/90 leading-relaxed max-w-2xl">
                  Dapatkan produk hasil perkebunan, gula aren murni, madu hutan, beras organik,
                  dan anyaman bambu langsung dari petani dan pengrajin lokal Desa Tangkolo dengan
                  jaminan keamanan transaksi.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3.5">
                  <a
                    href="#katalog"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors whitespace-nowrap"
                  >
                    Belanja Produk Sekarang
                  </a>
                  <button
                    type="button"
                    onClick={openDbStatusModal}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-950/70 hover:bg-emerald-950 border border-emerald-700/70 text-emerald-100 font-semibold text-sm transition-colors whitespace-nowrap"
                  >
                    <Database className="w-4 h-4" />
                    Status / Reset DB
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 4-Column Value Proposition Strip */}
          <section className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">100% Produk Alami</h2>
                  <p className="text-xs text-slate-500 mt-1">Hasil bumi &amp; kebun warga desa</p>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Pemberdayaan UMKM</h2>
                  <p className="text-xs text-slate-500 mt-1">Dukungan langsung kelompok tani</p>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Transaksi Aman</h2>
                  <p className="text-xs text-slate-500 mt-1">Keamanan Bcrypt &amp; audit trail</p>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Kirim Seluruh Wilayah</h2>
                  <p className="text-xs text-slate-500 mt-1">Packing rapi dan aman</p>
                </div>
              </div>
            </div>
          </section>

          <main id="katalog" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Katalog Produk Unggulan
                </h2>
                <p className="text-sm text-slate-500 mt-1 tabular-nums">
                  Menampilkan {filteredProducts.length} produk komoditas asli Tangkolo
                </p>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                    selectedCategory === 'all'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                  }`}
                >
                  Semua Kategori
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <p className="text-base font-semibold text-slate-800">
                  Komoditas yang dicari belum ditemukan
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Ubah kata kunci pencarian atau pilih kategori produk lainnya.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800"
                >
                  Tampilkan Semua Produk
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id}
                    className="group bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <button
                      type="button"
                      onClick={() => openProductDetail(product)}
                      className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden text-left"
                    >
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </button>

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                        <span className="truncate font-semibold uppercase tracking-wide text-emerald-700">
                          {product.categoryName || 'UMKM'}
                        </span>
                        <span className="shrink-0 ml-2">
                          {product.weightGrams} gr · Stok: {product.stock}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openProductDetail(product)}
                        className="mt-2 text-left"
                      >
                        <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                          {product.name}
                        </h3>
                      </button>

                      <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>

                      <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-slate-100">
                        <div>
                          <div className="text-[11px] text-slate-400">Harga Warga</div>
                          <div className="text-base font-bold text-emerald-700 tabular-nums">
                            {formatRupiah(product.price)}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={product.stock <= 0}
                          onClick={() => openProductDetail(product)}
                          className="px-4 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-700 text-emerald-800 hover:text-white disabled:bg-slate-100 disabled:text-slate-400 text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                        >
                          {product.stock > 0 ? 'Beli' : 'Habis'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {/* PRODUCT DETAIL VIEW (PDP) */}
      {storeView === 'detail' && activeProduct && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          <div className="text-xs text-slate-500 flex items-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => setStoreView('catalog')}
              className="hover:text-emerald-700"
            >
              Beranda
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(activeProduct.categoryId);
                setStoreView('catalog');
              }}
              className="hover:text-emerald-700"
            >
              {activeProduct.categoryName}
            </button>
            <span>/</span>
            <span className="text-slate-900 font-semibold truncate">{activeProduct.name}</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              <ProductImage
                src={activeProduct.imageUrl}
                alt={activeProduct.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-col">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {activeProduct.categoryName}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">
                {activeProduct.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
                  100% Produk Desa Tangkolo
                </span>
                <span>{activeProduct.weightGrams} gram</span>
                <span>·</span>
                <span>Stok: {activeProduct.stock}</span>
              </div>

              <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Harga Komoditas:</div>
                <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">
                  {formatRupiah(activeProduct.price)}
                </div>
              </div>

              <div className="mt-6">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Deskripsi Produk:
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {activeProduct.description}
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Jumlah:
                  </span>
                  <div className="inline-flex items-center border border-slate-300 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPdpQty((q) => Math.max(1, q - 1))}
                      className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-l-lg"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-4 text-sm font-bold tabular-nums">{pdpQty}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPdpQty((q) => Math.min(Math.max(1, activeProduct.stock), q + 1))
                      }
                      className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-r-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">
                    Maks. {activeProduct.stock} unit
                  </span>
                </div>

                <button
                  type="button"
                  disabled={activeProduct.stock <= 0}
                  onClick={() => handleAddAndGoToCart(activeProduct, pdpQty)}
                  className="w-full py-3.5 px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 text-white font-bold text-sm transition-colors"
                >
                  {activeProduct.stock > 0 ? 'Masukkan ke Keranjang' : 'Stok Habis'}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* KERANJANG BELANJA VIEW */}
      {storeView === 'cart' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          {bannerAlert && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium text-center">
              {bannerAlert}
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Keranjang Belanja</h1>
            <p className="text-sm text-slate-500 mt-1">
              Periksa kembali komoditas Tangkolo yang akan Anda pesan
            </p>
          </div>

          {cart.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-800">
                Keranjang belanja Anda masih kosong
              </p>
              <button
                type="button"
                onClick={() => setStoreView('catalog')}
                className="mt-4 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
              >
                Jelajahi Katalog Produk
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {cart.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <ProductImage
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100"
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {product.name}
                          </h3>
                          <div className="text-xs font-semibold text-emerald-700 tabular-nums mt-0.5">
                            {formatRupiah(product.price)}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                            Bobot: {product.weightGrams} gr
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-5">
                        <input
                          type="number"
                          min={1}
                          max={product.stock}
                          value={draftQuantities[product.id] ?? quantity}
                          onChange={(e) =>
                            setDraftQuantities((prev) => ({
                              ...prev,
                              [product.id]: Number(e.target.value),
                            }))
                          }
                          className="w-20 px-3 py-1.5 text-sm font-semibold text-center rounded-lg border border-slate-300 tabular-nums"
                        />
                        <div className="text-sm font-bold text-slate-900 tabular-nums min-w-[90px] text-right">
                          {formatRupiah(product.price * quantity)}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveFromCart(product.id)}
                          aria-label={`Hapus ${product.name}`}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Kosongkan Keranjang
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCartUpdates}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                  >
                    Perbarui Jumlah
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                  Ringkasan Belanja
                </h2>
                <div className="space-y-2.5 text-sm border-b border-slate-100 pb-4">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Item</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {cartCount} barang
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Estimasi Berat</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {(cartWeightGrams / 1000).toFixed(2)} kg
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Belanja</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatRupiah(cartSubtotal)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Total Pembayaran</span>
                  <span className="text-lg font-bold text-emerald-700 tabular-nums">
                    {formatRupiah(cartSubtotal)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoToCheckout}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors"
                >
                  {user ? 'Lanjut ke Checkout' : 'Masuk untuk Checkout'}
                </button>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Transaksi terverifikasi dan pembayaran resmi via BUMDes Karya Mandiri Desa
                  Tangkolo.
                </p>
              </div>
            </div>
          )}
        </main>
      )}

      {/* CHECKOUT PEMESANAN VIEW */}
      {storeView === 'checkout' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Checkout Pemesanan</h1>
            <p className="text-sm text-slate-500 mt-1">
              Lengkapi data pengiriman dan pilih metode pembayaran
            </p>
          </div>

          <form
            onSubmit={handleSubmitOrder}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
          >
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900">Informasi Pengiriman</h2>

              {checkoutError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
                  {checkoutError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                    Nama Penerima *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                    Nomor WhatsApp / HP *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                  Alamat Lengkap Pengiriman *
                </label>
                <textarea
                  required
                  rows={3}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-2">
                  Pilih Metode Pembayaran *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TRANSFER BANK')}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      paymentMethod === 'TRANSFER BANK'
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">
                      Transfer Bank / QRIS BUMDes
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Bank BJB / BRI / Mandiri Rekening Desa
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3.5 rounded-xl border text-left transition-colors ${
                      paymentMethod === 'COD'
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">Bayar di Tempat (COD)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Bayar tunai di Balai Desa / kurir warga
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                  Catatan Tambahan untuk Petani/Pengurus (Opsional)
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Contoh: Packing kayu atau tolong kirim sebelum jam 12 siang"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStoreView('cart')}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  ← Kembali ke Keranjang
                </button>
                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-60"
                >
                  {checkoutLoading ? 'Memproses...' : 'Konfirmasi & Buat Pesanan'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Rincian Pesanan
              </h2>
              <div className="space-y-3 border-b border-slate-100 pb-4">
                {cart.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-100"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {product.name}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {quantity} × {formatRupiah(product.price)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                      {formatRupiah(product.price * quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-xs border-b border-slate-100 pb-4">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Barang</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatRupiah(cartSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Ongkos Kirim Kurir Desa</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatRupiah(SHIPPING_FEE)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Total Tagihan</span>
                <span className="text-lg font-bold text-emerald-700 tabular-nums">
                  {formatRupiah(cartSubtotal + SHIPPING_FEE)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                Transaksi Anda dicatat secara permanen di basis data dengan nomor pesanan resmi
                BUMDes Desa Tangkolo.
              </div>
            </div>
          </form>
        </main>
      )}

      {/* MY ORDERS VIEW */}
      {storeView === 'orders' && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Pesanan Saya</h1>
              <p className="text-sm text-slate-500 mt-1">
                Pantau status pengiriman dan unggah bukti pembayaran transfer
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStoreView('catalog')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali Belanja
            </button>
          </div>

          {loadingOrders ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
              Memuat daftar pesanan...
            </div>
          ) : myOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
              Anda belum memiliki riwayat pesanan.
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {order.orderNumber}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {formatDateTimeShort(order.createdAt)} · {order.items.length} jenis produk ·{' '}
                      {order.paymentMethod}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Total Pembayaran</div>
                      <div className="text-base font-bold text-emerald-700 tabular-nums">
                        {formatRupiah(order.totalAmount)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(order);
                        setStoreView('order-detail');
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-200 hover:border-emerald-600 text-xs font-semibold text-slate-800"
                    >
                      Rincian Transaksi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* RINCIAN TRANSAKSI VIEW */}
      {storeView === 'order-detail' && selectedOrder && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
          {bannerAlert && (
            <div className="no-print mb-6 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium text-center">
              {bannerAlert}
            </div>
          )}

          <div className="no-print text-xs text-slate-500 flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={openMyOrders}
              className="hover:text-emerald-700 font-medium"
            >
              ← Kembali ke Pesanan
            </button>
            <span>/</span>
            <span className="font-mono font-semibold text-emerald-700">
              {selectedOrder.orderNumber}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Rincian Transaksi</h1>
              <p className="text-xs text-slate-500 mt-1">
                Dibuat pada {formatDateTimeShort(selectedOrder.createdAt)} WIB
              </p>
            </div>
            <div className="flex items-center gap-3">
              <OrderStatusBadge status={selectedOrder.status} />
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Bukti
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                  Barang yang Dipesan
                </h2>
                <div className="divide-y divide-slate-100">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <ProductImage
                          src={item.imageUrl}
                          alt={item.productName}
                          className="w-12 h-12 rounded-lg object-cover shrink-0 bg-slate-100"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {item.productName}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {item.quantity} barang × {formatRupiah(item.price)}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                        {formatRupiah(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Belanja:</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatRupiah(orderSubtotal(selectedOrder))}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Ongkos Kirim Kurir Desa:</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatRupiah(selectedOrder.shippingFee || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100 text-sm">
                    <span className="font-bold text-slate-900">Total Pembayaran:</span>
                    <span className="text-lg font-bold text-emerald-700 tabular-nums">
                      {formatRupiah(selectedOrder.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedOrder.paymentMethod === 'TRANSFER BANK' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                      Rekening BUMDes Karya Mandiri Desa Tangkolo
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Silakan transfer tepat sejumlah{' '}
                      <strong className="text-emerald-700">
                        {formatRupiah(selectedOrder.totalAmount)}
                      </strong>{' '}
                      ke salah satu rekening resmi desa berikut:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="text-xs font-semibold text-slate-600">
                        Bank BJB (Jawa Barat)
                      </div>
                      <div className="text-base font-mono font-bold text-emerald-700 mt-1">
                        0098-7654-3210
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        a.n. BUMDes Karya Mandiri Tangkolo
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="text-xs font-semibold text-slate-600">Bank BRI</div>
                      <div className="text-base font-mono font-bold text-emerald-700 mt-1">
                        4321-0100-9876-501
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        a.n. BUMDes Karya Mandiri Tangkolo
                      </div>
                    </div>
                  </div>

                  <div className="no-print pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Konfirmasi Bukti Pembayaran
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Unggah foto struk / tangkapan layar transfer (JPG, PNG, WEBP)
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer">
                      <Upload className="w-4 h-4" />
                      {uploadingOrderId === selectedOrder.id
                        ? 'Mengunggah...'
                        : selectedOrder.paymentProofUrl
                          ? 'Ganti Bukti Pembayaran'
                          : 'Unggah Bukti Bayar'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadPaymentProof(selectedOrder.id, f);
                        }}
                      />
                    </label>
                  </div>

                  {selectedOrder.paymentProofUrl && (
                    <div className="pt-2">
                      <div className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Bukti Pembayaran Terunggah
                      </div>
                      <img
                        src={selectedOrder.paymentProofUrl}
                        alt="Bukti Pembayaran"
                        className="max-h-56 rounded-xl border border-slate-200 object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Informasi Pengiriman
              </h2>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-400">Nama Penerima:</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {selectedOrder.customerName}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Nomor WhatsApp / HP:</div>
                  <div className="font-semibold text-slate-900 font-mono mt-0.5">
                    {selectedOrder.customerPhone}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Alamat Pengiriman:</div>
                  <div className="font-semibold text-slate-900 mt-0.5 leading-relaxed">
                    {selectedOrder.shippingAddress}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Metode Pembayaran:</div>
                  <div className="inline-block mt-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold">
                    {selectedOrder.paymentMethod}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-slate-900">
              TangkoloMart · BUMDes Karya Mandiri Desa Tangkolo
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pasar digital komoditas pertanian, olahan pangan, dan kerajinan warga Desa Tangkolo.
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setStoreView('catalog')}
              className="hover:text-emerald-700"
            >
              Katalog Produk
            </button>
            <button
              type="button"
              onClick={openDbStatusModal}
              className="hover:text-emerald-700"
            >
              Status Database
            </button>
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={onNavigateAdmin}
                className="hover:text-emerald-700 font-semibold text-emerald-700"
              >
                Dashboard BUMDes
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Status / Reset DB Modal */}
      {dbModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-700" />
                <h3 className="text-lg font-bold text-slate-900">
                  Status Penyimpanan &amp; Reset Data
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDbModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {dbFeedback && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
                {dbFeedback}
              </div>
            )}

            {dbStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xl font-bold text-slate-900 tabular-nums">
                      {dbStatus.counts.products}
                    </div>
                    <div className="text-xs text-slate-500">Produk UMKM</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xl font-bold text-slate-900 tabular-nums">
                      {dbStatus.counts.categories}
                    </div>
                    <div className="text-xs text-slate-500">Kategori</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xl font-bold text-slate-900 tabular-nums">
                      {dbStatus.counts.orders}
                    </div>
                    <div className="text-xs text-slate-500">Pesanan</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="text-xl font-bold text-slate-900 tabular-nums">
                      {dbStatus.counts.users}
                    </div>
                    <div className="text-xs text-slate-500">Pengguna</div>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 col-span-2">
                    <div className="text-xl font-bold text-slate-900 tabular-nums">
                      {dbStatus.counts.auditLogs}
                    </div>
                    <div className="text-xs text-slate-500">Catatan Audit Keamanan</div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div>
                    Penyimpanan: <strong className="text-slate-700">{dbStatus.engine}</strong>
                  </div>
                  <div>
                    Pembaruan terakhir:{' '}
                    <span className="font-mono">
                      {formatDateTimeShort(dbStatus.lastUpdatedAt)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  {user?.role === 'admin' ? (
                    <button
                      type="button"
                      disabled={dbLoading}
                      onClick={handleResetDatabase}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`} />
                      Reset ke Data Awal
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Reset database hanya diizinkan untuk Admin BUMDes (RBAC aktif).
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setDbModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                Memuat status basis data...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
