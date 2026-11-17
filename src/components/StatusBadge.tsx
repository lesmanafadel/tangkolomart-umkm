import type { AuditEvent, OrderStatus } from '../types.ts';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    'Menunggu Bayar': 'bg-amber-50 text-amber-800 border-amber-200',
    Diproses: 'bg-sky-50 text-sky-800 border-sky-200',
    Dikirim: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    Selesai: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Dibatalkan: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${styles[status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
    >
      {status}
    </span>
  );
}

export function AuditEventBadge({ event }: { event: AuditEvent }) {
  const isSuccess =
    event === 'LOGIN_SUCCESS' ||
    event === 'ORDER_CREATED' ||
    event === 'PRODUCT_CREATED' ||
    event === 'CATEGORY_CREATED' ||
    event === 'REGISTER';
  const isDanger =
    event === 'LOGIN_FAILED' ||
    event === 'PRODUCT_DELETED' ||
    event === 'CATEGORY_DELETED' ||
    event === 'RATE_LIMIT_TRIGGERED';
  const isWarn = event === 'DB_RESET' || event === 'ORDER_STATUS_UPDATED';

  let cls = 'bg-slate-100 text-slate-700 border-slate-200';
  if (isSuccess) cls = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  else if (isDanger) cls = 'bg-rose-50 text-rose-800 border-rose-200';
  else if (isWarn) cls = 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold border whitespace-nowrap ${cls}`}
    >
      {event}
    </span>
  );
}
