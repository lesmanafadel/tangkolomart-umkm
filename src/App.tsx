import { useCallback, useEffect, useState } from 'react';
import { apiFetch, setStoredToken } from './lib/api.ts';
import { Storefront } from './components/Storefront.tsx';
import { AuthViews } from './components/AuthViews.tsx';
import { AdminConsole } from './components/AdminConsole.tsx';
import type { CartItem, Category, Product, PublicUser } from './types.ts';

type AppPage = 'store' | 'login' | 'register' | 'admin';

const CART_KEY = 'tangkolomart_cart';

function loadSavedCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [page, setPage] = useState<AppPage>('store');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(loadSavedCart);
  const [bootLoading, setBootLoading] = useState(true);

  const loadStoreData = useCallback(async () => {
    const [catRes, prodRes] = await Promise.all([
      apiFetch<{ categories: Category[] }>('/api/categories'),
      apiFetch<{ products: Product[] }>('/api/products'),
    ]);
    setCategories(catRes.categories);
    setProducts(prodRes.products);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await loadStoreData();
        const me = await apiFetch<{ user: PublicUser | null }>('/api/auth/me').catch(() => ({
          user: null,
        }));
        if (me.user) {
          setUser(me.user);
        }
      } finally {
        setBootLoading(false);
      }
    }
    void init();
  }, [loadStoreData]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart]);

  function handleAddToCart(product: Product, quantity = 1) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(product.stock, i.quantity + quantity) }
            : i,
        );
      }
      return [...prev, { product, quantity: Math.min(product.stock, Math.max(1, quantity)) }];
    });
  }

  function handleUpdateCartQty(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: Math.min(i.product.stock, quantity) }
          : i,
      ),
    );
  }

  function handleRemoveFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function handleClearCart() {
    setCart([]);
  }

  async function handleLogout() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredToken(null);
    setUser(null);
    setPage('store');
  }

  function handleAuthSuccess(loggedInUser: PublicUser) {
    setUser(loggedInUser);
    if (loggedInUser.role === 'admin') {
      setPage('admin');
    } else {
      setPage('store');
    }
  }

  if (bootLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 mx-auto animate-pulse" />
          <p className="text-sm font-medium text-slate-600">Memuat TangkoloMart...</p>
        </div>
      </div>
    );
  }

  if (page === 'login' || page === 'register') {
    return (
      <AuthViews
        mode={page}
        onSwitchMode={(next) => setPage(next)}
        onSuccess={handleAuthSuccess}
        onBackToStore={() => setPage('store')}
      />
    );
  }

  if (page === 'admin' && user?.role === 'admin') {
    return (
      <AdminConsole
        user={user}
        onBackToStore={() => setPage('store')}
        onLogout={handleLogout}
        onStoreChanged={loadStoreData}
      />
    );
  }

  return (
    <Storefront
      user={user}
      categories={categories}
      products={products}
      cart={cart}
      onAddToCart={handleAddToCart}
      onUpdateCartQty={handleUpdateCartQty}
      onRemoveFromCart={handleRemoveFromCart}
      onClearCart={handleClearCart}
      onNavigateAuth={(mode) => setPage(mode)}
      onNavigateAdmin={() => {
        if (user?.role === 'admin') setPage('admin');
      }}
      onLogout={handleLogout}
      onRefreshStore={loadStoreData}
    />
  );
}
