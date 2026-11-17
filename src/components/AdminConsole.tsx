import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Tags,
  ClipboardList,
  BarChart3,
  ShieldAlert,
  Store,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Download,
  Printer,
  Menu,
  X,
  ArrowLeft,
  Search,
  DollarSign,
  ShoppingBag,
  Users,
} from 'lucide-react';
import {
  apiFetch,
  formatAuditTimestamp,
  formatDateSlashTime,
  formatDateTimeShort,
  formatRupiah,
  formatShortClockDate,
  getStoredToken,
  readFileAsCompressedDataUrl,
} from '../lib/api.ts';
import { ProductImage } from './ProductImage.tsx';
import { AuditEventBadge, OrderStatusBadge } from './StatusBadge.tsx';
import type {
  AuditLog,
  Category,
  DashboardSummary,
  Order,
  OrderStatus,
  Product,
  PublicUser,
  TopCommodity,
} from '../types.ts';

type AdminTab =
  | 'dashboard'
  | 'products'
  | 'product-form'
  | 'categories'
  | 'orders'
  | 'reports'
  | 'audit';

interface AdminConsoleProps {
  user: PublicUser;
  onBackToStore: () => void;
  onLogout: () => void;
  onStoreChanged: () => Promise<void>;
}

export function AdminConsole({
  user,
  onBackToStore,
  onLogout,
  onStoreChanged,
}: AdminConsoleProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dashboard state
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prodSearch, setProdSearch] = useState('');
  const [prodCatFilter, setProdCatFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form state
  const [pfName, setPfName] = useState('');
  const [pfCategoryId, setPfCategoryId] = useState('');
  const [pfPrice, setPfPrice] = useState('35000');
  const [pfStock, setPfStock] = useState('20');
  const [pfWeight, setPfWeight] = useState('500');
  const [pfDescription, setPfDescription] = useState('');
  const [pfImageUrl, setPfImageUrl] = useState('');
  const [pfIsActive, setPfIsActive] = useState(true);
  const [pfError, setPfError] = useState('');
  const [pfSaving, setPfSaving] = useState(false);

  // Categories Form state
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catError, setCatError] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordSearch, setOrdSearch] = useState('');
  const [ordStatusFilter, setOrdStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderStatusUpdating, setOrderStatusUpdating] = useState(false);

  // Reports state
  const [repStartDate, setRepStartDate] = useState('2026-11-01');
  const [repEndDate, setRepEndDate] = useState('2026-11-30');
  const [repStatus, setRepStatus] = useState('all');
  const [repOrders, setRepOrders] = useState<Order[]>([]);
  const [repMetrics, setRepMetrics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    completedOrders: 0,
    averageOrderValue: 0,
  });
  const [repTop, setRepTop] = useState<TopCommodity[]>([]);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEvent, setAuditEvent] = useState('all');

  const loadDashboard = useCallback(async () => {
    const res = await apiFetch<DashboardSummary>('/api/admin/dashboard');
    setDashboard(res);
  }, []);

  const loadProductsAndCategories = useCallback(async () => {
    const [prodRes, catRes] = await Promise.all([
      apiFetch<{ products: Product[] }>(
        `/api/products?includeInactive=true&search=${encodeURIComponent(prodSearch)}&categoryId=${encodeURIComponent(prodCatFilter)}`,
      ),
      apiFetch<{ categories: Category[] }>('/api/categories'),
    ]);
    setProducts(prodRes.products);
    setCategories(catRes.categories);
  }, [prodSearch, prodCatFilter]);

  const loadOrders = useCallback(async () => {
    const res = await apiFetch<{ orders: Order[] }>(
      `/api/orders?search=${encodeURIComponent(ordSearch)}&status=${encodeURIComponent(ordStatusFilter)}`,
    );
    setOrders(res.orders);
  }, [ordSearch, ordStatusFilter]);

  const loadReports = useCallback(async () => {
    const params = new URLSearchParams();
    if (repStartDate) params.set('startDate', repStartDate);
    if (repEndDate) params.set('endDate', repEndDate);
    if (repStatus) params.set('status', repStatus);
    const res = await apiFetch<{
      orders: Order[];
      metrics: {
        totalRevenue: number;
        totalOrders: number;
        completedOrders: number;
        averageOrderValue: number;
      };
      topCommodities: TopCommodity[];
    }>(`/api/admin/reports?${params.toString()}`);
    setRepOrders(res.orders);
    setRepMetrics(res.metrics);
    setRepTop(res.topCommodities);
  }, [repStartDate, repEndDate, repStatus]);

  const loadAuditLogs = useCallback(async () => {
    const res = await apiFetch<{ logs: AuditLog[] }>(
      `/api/admin/audit-logs?search=${encodeURIComponent(auditSearch)}&event=${encodeURIComponent(auditEvent)}`,
    );
    setAuditLogs(res.logs);
  }, [auditSearch, auditEvent]);

  useEffect(() => {
    if (tab === 'dashboard') void loadDashboard();
    else if (tab === 'products' || tab === 'categories' || tab === 'product-form') {
      void loadProductsAndCategories();
    } else if (tab === 'orders') void loadOrders();
    else if (tab === 'reports') void loadReports();
    else if (tab === 'audit') void loadAuditLogs();
  }, [tab, loadDashboard, loadProductsAndCategories, loadOrders, loadReports, loadAuditLogs]);

  function openNewProductForm() {
    setEditingProduct(null);
    setPfName('');
    setPfCategoryId(categories[0]?.id || '');
    setPfPrice('35000');
    setPfStock('20');
    setPfWeight('500');
    setPfDescription('');
    setPfImageUrl('');
    setPfIsActive(true);
    setPfError('');
    setTab('product-form');
  }

  function openEditProductForm(product: Product) {
    setEditingProduct(product);
    setPfName(product.name);
    setPfCategoryId(product.categoryId);
    setPfPrice(String(product.price));
    setPfStock(String(product.stock));
    setPfWeight(String(product.weightGrams));
    setPfDescription(product.description);
    setPfImageUrl(product.imageUrl);
    setPfIsActive(product.isActive);
    setPfError('');
    setTab('product-form');
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setPfError('');
    setPfSaving(true);
    try {
      const payload = {
        name: pfName,
        categoryId: pfCategoryId,
        price: Number(pfPrice),
        stock: Number(pfStock),
        weightGrams: Number(pfWeight),
        description: pfDescription,
        imageUrl: pfImageUrl,
        isActive: pfIsActive,
      };
      if (editingProduct) {
        await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await loadProductsAndCategories();
      await onStoreChanged();
      setTab('products');
    } catch (err) {
      setPfError(err instanceof Error ? err.message : 'Gagal menyimpan produk.');
    } finally {
      setPfSaving(false);
    }
  }

  async function handleDeleteProduct(product: Product) {
    await apiFetch(`/api/products/${product.id}`, { method: 'DELETE' });
    await loadProductsAndCategories();
    await onStoreChanged();
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatError('');
    setCatSaving(true);
    try {
      await apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      setCatName('');
      setCatDesc('');
      await loadProductsAndCategories();
      await onStoreChanged();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Gagal menambahkan kategori.');
    } finally {
      setCatSaving(false);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    setCatError('');
    try {
      await apiFetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
      await loadProductsAndCategories();
      await onStoreChanged();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Gagal menghapus kategori.');
    }
  }

  async function handleUpdateOrderStatus(orderId: string, status: OrderStatus) {
    setOrderStatusUpdating(true);
    try {
      const res = await apiFetch<{ order: Order }>(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSelectedOrder(res.order);
      await loadOrders();
      await loadDashboard();
      await onStoreChanged();
    } finally {
      setOrderStatusUpdating(false);
    }
  }

  async function handleDownloadCsv() {
    const params = new URLSearchParams();
    if (repStartDate) params.set('startDate', repStartDate);
    if (repEndDate) params.set('endDate', repEndDate);
    if (repStatus) params.set('status', repStatus);
    const token = getStoredToken();
    const res = await fetch(`/api/admin/reports/csv?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'laporan-penjualan-tangkolomart.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const pageTitles: Record<AdminTab, string> = {
    dashboard: 'Dashboard Pengelola BUMDes Tangkolo',
    products: 'Kelola Produk UMKM Tangkolo',
    'product-form': editingProduct ? 'Ubah Data Produk' : 'Tambah Produk Baru',
    categories: 'Kategori Komoditas Tangkolo',
    orders: 'Kelola Pesanan Masuk',
    reports: 'Laporan Rekapitulasi Penjualan',
    audit: 'Audit Log & Keamanan Sistem',
  };

  function NavContent() {
    const navBtn = (active: boolean) =>
      `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
        active
          ? 'bg-emerald-600 text-white font-semibold'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`;

    return (
      <div className="flex flex-col h-full bg-slate-900 text-white">
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold shrink-0">
              T
            </div>
            <div>
              <div className="text-base font-bold tracking-tight">
                Tangkolo<span className="text-emerald-400">Admin</span>
              </div>
              <div className="text-[11px] text-slate-400">BUMDes Tangkolo</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div>
            <button
              type="button"
              onClick={() => {
                setTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className={navBtn(tab === 'dashboard')}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              Dashboard
            </button>
          </div>

          <div>
            <div className="px-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Katalog &amp; Data
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setTab('products');
                  setMobileMenuOpen(false);
                }}
                className={navBtn(tab === 'products' || tab === 'product-form')}
              >
                <Package className="w-4 h-4 shrink-0" />
                Produk UMKM
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('categories');
                  setMobileMenuOpen(false);
                }}
                className={navBtn(tab === 'categories')}
              >
                <Tags className="w-4 h-4 shrink-0" />
                Kategori Produk
              </button>
            </div>
          </div>

          <div>
            <div className="px-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Transaksi &amp; Laporan
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setTab('orders');
                  setMobileMenuOpen(false);
                }}
                className={navBtn(tab === 'orders')}
              >
                <ClipboardList className="w-4 h-4 shrink-0" />
                Kelola Pesanan
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('reports');
                  setMobileMenuOpen(false);
                }}
                className={navBtn(tab === 'reports')}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                Laporan Penjualan
              </button>
            </div>
          </div>

          <div>
            <div className="px-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Keamanan &amp; Sistem
            </div>
            <button
              type="button"
              onClick={() => {
                setTab('audit');
                setMobileMenuOpen(false);
              }}
              className={navBtn(tab === 'audit')}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Audit Log Keamanan
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-1">
            <button
              type="button"
              onClick={onBackToStore}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-emerald-400 hover:bg-slate-800 transition-colors"
            >
              <Store className="w-4 h-4 shrink-0" />
              Lihat Toko Publik
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Keluar
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{user.fullName}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 mt-0.5">
              ROLE: {user.role.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        <NavContent />
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 flex">
          <div className="w-64 h-full">
            <NavContent />
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">{pageTitles[tab]}</h1>
          </div>

          <button
            type="button"
            onClick={onBackToStore}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Store className="w-4 h-4 text-emerald-700" />
            Toko Publik
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 space-y-6">
          {/* 1. DASHBOARD */}
          {tab === 'dashboard' && dashboard && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">Total Omset Penjualan</div>
                    <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1.5">
                      {formatRupiah(dashboard.totalRevenue)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Semua transaksi sukses</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">Total Transaksi</div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
                      {dashboard.totalOrders} Pesanan
                    </div>
                    <div className="text-xs text-amber-600 font-medium mt-1 tabular-nums">
                      {dashboard.pendingPaymentOrders} Menunggu Bayar
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700 shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Komoditas &amp; Produk Aktif
                    </div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
                      {dashboard.activeProductsCount} Produk
                    </div>
                    <div className="text-xs text-emerald-700 font-medium mt-1">
                      UMKM Desa Tangkolo
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Warga / Pembeli Terdaftar
                    </div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
                      {dashboard.registeredBuyersCount} Pengguna
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Akun terverifikasi Bcrypt</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Quick Actions Banner */}
              <div className="rounded-2xl bg-emerald-800 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">
                    Aksi Cepat Pengelolaan BUMDes Tangkolo
                  </h2>
                  <p className="text-xs sm:text-sm text-emerald-100 mt-1">
                    Kelola data komoditas desa, cek transaksi masuk, atau unduh laporan penjualan
                    berkala.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      void loadProductsAndCategories().then(openNewProductForm);
                    }}
                    className="px-4 py-2.5 rounded-lg bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    Tambah Produk
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('reports')}
                    className="px-4 py-2.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-950 border border-emerald-600/60 text-white text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    Rekap Laporan
                  </button>
                </div>
              </div>

              {/* Recent Orders & Security Logs */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                      Transaksi Terbaru
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('orders')}
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Semua Pesanan →
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-5">No. Pesanan</th>
                          <th className="py-3 px-4">Pembeli</th>
                          <th className="py-3 px-4">Total</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {dashboard.recentOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {ord.orderNumber}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">{ord.customerName}</td>
                            <td className="py-3.5 px-4 font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                              {formatRupiah(ord.totalAmount)}
                            </td>
                            <td className="py-3.5 px-4">
                              <OrderStatusBadge status={ord.status} />
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(ord)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700"
                              >
                                Kelola
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                      Log Keamanan
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('audit')}
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Semua Log →
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    {dashboard.recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50/60"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <AuditEventBadge event={log.event} />
                          <span className="text-[11px] font-mono text-slate-400">
                            {formatShortClockDate(log.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1.5 leading-snug">
                          {log.description}
                        </p>
                        <div className="text-[11px] font-mono text-slate-400 mt-1">
                          IP: {log.ipAddress}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 2. PRODUCTS LIST */}
          {tab === 'products' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Katalog Produk Desa Tangkolo
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kelola data komoditas pangan, hasil bumi, dan kerajinan warga
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewProductForm}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Produk Baru
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    placeholder="Cari nama komoditas..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <select
                  value={prodCatFilter}
                  onChange={(e) => setProdCatFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-600"
                >
                  <option value="all">Semua Kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadProductsAndCategories()}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800"
                >
                  Filter
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 px-5">Foto</th>
                        <th className="py-3.5 px-4">Nama Produk &amp; Kategori</th>
                        <th className="py-3.5 px-4">Harga Jual</th>
                        <th className="py-3.5 px-4">Stok</th>
                        <th className="py-3.5 px-4">Bobot</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {products.map((prod) => (
                        <tr key={prod.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-5">
                            <ProductImage
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-11 h-11 rounded-lg object-cover bg-slate-100"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{prod.name}</div>
                            <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                              {prod.categoryName}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                            {formatRupiah(prod.price)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 tabular-nums">
                            {prod.stock} unit
                          </td>
                          <td className="py-3 px-4 text-slate-500 tabular-nums">
                            {prod.weightGrams} gr
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                                prod.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {prod.isActive ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                aria-label={`Ubah ${prod.name}`}
                                onClick={() => openEditProductForm(prod)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Hapus ${prod.name}`}
                                onClick={() => void handleDeleteProduct(prod)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 3. PRODUCT CREATE / EDIT FORM */}
          {tab === 'product-form' && (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingProduct
                      ? 'Perbarui Komoditas Tangkolo'
                      : 'Tambah Produk Komoditas Tangkolo'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lengkapi spesifikasi komoditas UMKM untuk dipublikasikan
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('products')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Batal &amp; Kembali
                </button>
              </div>

              <form
                onSubmit={handleSaveProduct}
                className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5"
              >
                {pfError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    {pfError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Produk Komoditas *
                  </label>
                  <input
                    type="text"
                    required
                    value={pfName}
                    onChange={(e) => setPfName(e.target.value)}
                    placeholder="Contoh: Kopi Robusta Tangkolo 250gr"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Kategori Produk *
                    </label>
                    <select
                      required
                      value={pfCategoryId}
                      onChange={(e) => setPfCategoryId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">-- Pilih Kategori --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Harga Jual (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={pfPrice}
                      onChange={(e) => setPfPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Jumlah Stok Tersedia *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={pfStock}
                      onChange={(e) => setPfStock(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Estimasi Bobot (Gram) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={pfWeight}
                      onChange={(e) => setPfWeight(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Foto Produk (JPG, PNG, WEBP, maks 2MB)
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await readFileAsCompressedDataUrl(file);
                          setPfImageUrl(dataUrl);
                        } catch (err) {
                          setPfError(
                            err instanceof Error ? err.message : 'Gagal membaca foto.',
                          );
                        }
                      }}
                      className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    {pfImageUrl && (
                      <img
                        src={pfImageUrl}
                        alt="Pratinjau"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Deskripsi &amp; Keunggulan Produk
                  </label>
                  <textarea
                    rows={4}
                    value={pfDescription}
                    onChange={(e) => setPfDescription(e.target.value)}
                    placeholder="Jelaskan asal usul bahan, rasa, keaslian, dan manfaat produk warga Tangkolo ini..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pfIsActive}
                    onChange={(e) => setPfIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Aktifkan produk ini agar langsung tampil di etalase publik TangkoloMart
                </label>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setTab('products')}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={pfSaving}
                    className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-60"
                  >
                    {pfSaving ? 'Menyimpan...' : 'Simpan Produk'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 4. CATEGORIES */}
          {tab === 'categories' && (
            <>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Kategori Komoditas Desa Tangkolo
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola pengelompokan produk pertanian, olahan pangan, dan kerajinan
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <form
                  onSubmit={handleCreateCategory}
                  className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Tambah Kategori Baru
                  </h3>
                  {catError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                      {catError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Kategori *
                    </label>
                    <input
                      type="text"
                      required
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="Contoh: Kopi & Minuman Tradisional"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Keterangan / Deskripsi Singkat
                    </label>
                    <textarea
                      rows={3}
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Deskripsi singkat komoditas desa dalam kelompok ini..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={catSaving}
                    className="w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                  >
                    {catSaving ? 'Menyimpan...' : 'Simpan Kategori'}
                  </button>
                </form>

                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Daftar Kategori Aktif
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-5">Nama Kategori</th>
                          <th className="py-3 px-4">Slug</th>
                          <th className="py-3 px-4">Jml Produk</th>
                          <th className="py-3 px-5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {categories.map((cat) => (
                          <tr key={cat.id}>
                            <td className="py-3.5 px-5">
                              <div className="font-bold text-slate-900">{cat.name}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {cat.description}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                              {cat.slug}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold tabular-nums">
                                {cat.productCount ?? 0} komoditas
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {(cat.productCount ?? 0) > 0 ? (
                                <span className="text-[11px] text-slate-400 font-medium">
                                  Terpakai
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteCategory(cat.id)}
                                  className="text-xs font-semibold text-rose-600 hover:underline"
                                >
                                  Hapus
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 5. ORDERS */}
          {tab === 'orders' && (
            <>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Daftar Transaksi Pesanan Pelanggan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola verifikasi pembayaran dan pengiriman komoditas Desa Tangkolo
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={ordSearch}
                    onChange={(e) => setOrdSearch(e.target.value)}
                    placeholder="Cari No. Pesanan / Penerima..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <select
                  value={ordStatusFilter}
                  onChange={(e) => setOrdStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                >
                  <option value="all">Semua Status</option>
                  <option value="Menunggu Bayar">Menunggu Bayar</option>
                  <option value="Diproses">Diproses</option>
                  <option value="Dikirim">Dikirim</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Dibatalkan">Dibatalkan</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadOrders()}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800"
                >
                  Filter
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 px-5">No. Pesanan</th>
                        <th className="py-3.5 px-4">Waktu Transaksi</th>
                        <th className="py-3.5 px-4">Penerima &amp; Kontak</th>
                        <th className="py-3.5 px-4">Metode Bayar</th>
                        <th className="py-3.5 px-4">Total Tagihan</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap tabular-nums">
                            {formatDateTimeShort(ord.createdAt)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{ord.customerName}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {ord.customerPhone}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 font-medium">
                            {ord.paymentMethod}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                            {formatRupiah(ord.totalAmount)}
                          </td>
                          <td className="py-3.5 px-4">
                            <OrderStatusBadge status={ord.status} />
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(ord)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 font-semibold text-slate-800"
                            >
                              Kelola &amp; Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 6. REPORTS */}
          {tab === 'reports' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-slate-500">
                  Analisis omset dan volume transaksi komoditas UMKM Desa Tangkolo
                </p>
                <div className="no-print flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void handleDownloadCsv()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh Berkas CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak / Simpan PDF
                  </button>
                </div>
              </div>

              <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Dari Tanggal:
                  </label>
                  <input
                    type="date"
                    value={repStartDate}
                    onChange={(e) => setRepStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Sampai Tanggal:
                  </label>
                  <input
                    type="date"
                    value={repEndDate}
                    onChange={(e) => setRepEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Status Pesanan:
                  </label>
                  <select
                    value={repStatus}
                    onChange={(e) => setRepStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="all">Semua Status</option>
                    <option value="Menunggu Bayar">Menunggu Bayar</option>
                    <option value="Diproses">Diproses</option>
                    <option value="Dikirim">Dikirim</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Dibatalkan">Dibatalkan</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadReports()}
                    className="flex-1 py-2 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                  >
                    Terapkan Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRepStartDate('');
                      setRepEndDate('');
                      setRepStatus('all');
                    }}
                    className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs text-slate-500">Total Omset Periode Ini</div>
                  <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                    {formatRupiah(repMetrics.totalRevenue)}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs text-slate-500">Volume Transaksi</div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                    {repMetrics.totalOrders} Pesanan
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs text-slate-500">Pesanan Selesai / Tuntas</div>
                  <div className="text-2xl font-bold text-sky-700 tabular-nums mt-1">
                    {repMetrics.completedOrders} Sukses
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="text-xs text-slate-500">Rata-rata Nilai Belanja</div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                    {formatRupiah(repMetrics.averageOrderValue)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Rincian Transaksi Terfilter
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-5">No. Pesanan</th>
                          <th className="py-3 px-4">Tanggal</th>
                          <th className="py-3 px-4">Penerima</th>
                          <th className="py-3 px-4">Nominal Tagihan</th>
                          <th className="py-3 px-5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {repOrders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="py-3 px-5 font-mono font-bold text-slate-900">
                              {ord.orderNumber}
                            </td>
                            <td className="py-3 px-4 text-slate-500 tabular-nums">
                              {formatDateSlashTime(ord.createdAt)}
                            </td>
                            <td className="py-3 px-4 text-slate-700">{ord.customerName}</td>
                            <td className="py-3 px-4 font-bold text-emerald-700 tabular-nums">
                              {formatRupiah(ord.totalAmount)}
                            </td>
                            <td className="py-3 px-5">
                              <OrderStatusBadge status={ord.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
                    Komoditas Terlaris
                  </h3>
                  <div className="space-y-3.5">
                    {repTop.map((item, index) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 last:border-none last:pb-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {item.productName}
                            </div>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {item.unitsSold} unit terjual
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 tabular-nums shrink-0">
                          {formatRupiah(item.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 7. AUDIT LOGS */}
          {tab === 'audit' && (
            <>
              <p className="text-xs text-slate-500">
                Pemantauan jejak digital autentikasi, transaksi, dan perubahan data secara langsung
              </p>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Cari IP, deskripsi, username..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <select
                  value={auditEvent}
                  onChange={(e) => setAuditEvent(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                >
                  <option value="all">Semua Event Aksi</option>
                  <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                  <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                  <option value="LOGOUT">LOGOUT</option>
                  <option value="REGISTER">REGISTER</option>
                  <option value="ORDER_CREATED">ORDER_CREATED</option>
                  <option value="PAYMENT_PROOF_UPLOADED">PAYMENT_PROOF_UPLOADED</option>
                  <option value="ORDER_STATUS_UPDATED">ORDER_STATUS_UPDATED</option>
                  <option value="PRODUCT_CREATED">PRODUCT_CREATED</option>
                  <option value="PRODUCT_UPDATED">PRODUCT_UPDATED</option>
                  <option value="PRODUCT_DELETED">PRODUCT_DELETED</option>
                  <option value="CATEGORY_CREATED">CATEGORY_CREATED</option>
                  <option value="DB_RESET">DB_RESET</option>
                  <option value="RATE_LIMIT_TRIGGERED">RATE_LIMIT_TRIGGERED</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadAuditLogs()}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800"
                >
                  Filter
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 px-5">Waktu Kejadian</th>
                        <th className="py-3.5 px-4">Event / Aksi</th>
                        <th className="py-3.5 px-4">Deskripsi Aktivitas</th>
                        <th className="py-3.5 px-4">Pengguna</th>
                        <th className="py-3.5 px-5">Alamat IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                            {formatAuditTimestamp(log.createdAt)}
                          </td>
                          <td className="py-3.5 px-4">
                            <AuditEventBadge event={log.event} />
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-slate-800 font-medium">{log.description}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
                              UA: {log.userAgent}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {log.username}
                          </td>
                          <td className="py-3.5 px-5 font-mono text-slate-500 whitespace-nowrap">
                            {log.ipAddress}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Clean Admin Footer */}
        <footer className="no-print bg-white border-t border-slate-200 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <strong className="text-slate-700">TangkoloMart Admin Panel</strong> · Sistem
            Informasi UMKM Desa Tangkolo
          </div>
          <div>Keamanan: Bcrypt Auth · Signed Token · Audit Trail</div>
        </footer>
      </div>

      {/* Order Detail & Status Management Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl my-8 space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="font-mono text-base font-bold text-slate-900">
                  {selectedOrder.orderNumber}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {formatDateTimeShort(selectedOrder.createdAt)} · {selectedOrder.paymentMethod}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-slate-400 font-semibold uppercase">Penerima</div>
                <div className="font-bold text-slate-900">{selectedOrder.customerName}</div>
                <div className="font-mono text-slate-600">{selectedOrder.customerPhone}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-slate-400 font-semibold uppercase">Alamat Pengiriman</div>
                <div className="text-slate-700 leading-relaxed">
                  {selectedOrder.shippingAddress}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                Rincian Barang
              </div>
              <div className="divide-y divide-slate-100 p-4 space-y-2">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 flex justify-between text-xs">
                    <span className="text-slate-700">
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {formatRupiah(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
                {(selectedOrder.shippingFee || 0) > 0 && (
                  <div className="pt-2 flex justify-between text-xs text-slate-500">
                    <span>Ongkos Kirim Kurir Desa</span>
                    <span className="tabular-nums">
                      {formatRupiah(selectedOrder.shippingFee)}
                    </span>
                  </div>
                )}
                <div className="pt-3 border-t border-slate-200 flex justify-between text-sm font-bold">
                  <span>Total Tagihan</span>
                  <span className="text-emerald-700 tabular-nums">
                    {formatRupiah(selectedOrder.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {selectedOrder.paymentProofUrl && (
              <div className="p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-700 mb-2">
                  Bukti Pembayaran Pelanggan
                </div>
                <img
                  src={selectedOrder.paymentProofUrl}
                  alt="Bukti Bayar"
                  className="max-h-48 rounded-lg border border-slate-200 object-contain"
                />
              </div>
            )}

            <div className="pt-2 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-700 mb-2.5">
                Perbarui Status Pesanan:
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'Menunggu Bayar',
                    'Diproses',
                    'Dikirim',
                    'Selesai',
                    'Dibatalkan',
                  ] as OrderStatus[]
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={orderStatusUpdating || selectedOrder.status === st}
                    onClick={() => void handleUpdateOrderStatus(selectedOrder.id, st)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      selectedOrder.status === st
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
