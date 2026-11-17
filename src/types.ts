export type UserRole = 'admin' | 'user';

export interface PublicUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  role: UserRole;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  productCount?: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  price: number;
  stock: number;
  weightGrams: number;
  imageUrl: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export type OrderStatus =
  | 'Menunggu Bayar'
  | 'Diproses'
  | 'Dikirim'
  | 'Selesai'
  | 'Dibatalkan';

export type PaymentMethod = 'TRANSFER BANK' | 'COD';

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  weightGrams: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  paymentMethod: PaymentMethod;
  notes: string;
  items: OrderItem[];
  totalWeightGrams: number;
  shippingFee: number;
  totalAmount: number;
  status: OrderStatus;
  paymentProofUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'ORDER_CREATED'
  | 'PAYMENT_PROOF_UPLOADED'
  | 'ORDER_STATUS_UPDATED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'CATEGORY_DELETED'
  | 'DB_RESET'
  | 'RATE_LIMIT_TRIGGERED';

export interface AuditLog {
  id: string;
  event: AuditEvent;
  description: string;
  userAgent: string;
  username: string;
  ipAddress: string;
  createdAt: string;
}

export interface DbStatusSummary {
  status: 'online';
  engine: string;
  lastUpdatedAt: string;
  counts: {
    products: number;
    activeProducts: number;
    categories: number;
    users: number;
    orders: number;
    auditLogs: number;
  };
}

export interface TopCommodity {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
}

export interface DashboardSummary {
  totalRevenue: number;
  totalOrders: number;
  pendingPaymentOrders: number;
  completedOrders: number;
  averageOrderValue: number;
  activeProductsCount: number;
  registeredBuyersCount: number;
  recentOrders: Order[];
  recentLogs: AuditLog[];
  topCommodities: TopCommodity[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}
