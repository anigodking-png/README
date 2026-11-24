import { useMemo } from 'react';
import { Activity, AlertTriangle, Boxes, CircleDollarSign, LogOut, RefreshCw, Receipt, TrendingUp, Users, Wallet, Warehouse } from 'lucide-react';

type Product = { id: string; name: string; sku: string; category: string; unit: string; costPrice: number; sellingPrice: number; quantity: number; reorderLevel: number };
type Movement = { id: string; productId: string; productName: string; type: 'purchase' | 'sale' | 'adjustment'; quantity: number; unitPrice: number; unitCost?: number; total: number; createdAt: string; customerName?: string; paymentMethod?: string };
type Customer = { id: string; name: string; phone: string; balance: number; totalSpent: number };
type Expense = { id: string; title: string; category: string; amount: number; date: string };
type TillPayment = { id: string; receipt: string; payer: string; phone: string; amount: number; date: string };
type DashboardData = { products: Product[]; movements: Movement[]; customers: Customer[]; expenses: Expense[]; tillPayments: TillPayment[]; settings: { tillNumber?: string; tillName?: string } };

const money = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value || 0);

export default function BusinessStatus({ data, onSignOut, onRefresh }: { data: DashboardData; onSignOut: () => void; onRefresh: () => Promise<void> }) {
  const products = data.products || [];
  const movements = data.movements || [];
  const sales = movements.filter(item => item.type === 'sale');
  const revenue = sales.reduce((sum, item) => sum + item.total, 0);
  const costOfSales = sales.reduce((sum, item) => sum + (item.unitCost ?? 0) * item.quantity, 0);
  const expenses = data.expenses || [];
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const grossProfit = revenue - costOfSales;
  const netProfit = grossProfit - expenseTotal;
  const stockValue = products.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);
  const debts = (data.customers || []).reduce((sum, customer) => sum + customer.balance, 0);
  const tillTotal = (data.tillPayments || []).reduce((sum, payment) => sum + payment.amount, 0);
  const lowStock = products.filter(item => item.quantity <= item.reorderLevel);
  const recentSales = useMemo(() => [...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12), [sales]);

  return <div className="status-shell">
    <header className="status-header">
      <div className="status-brand"><div className="status-brand-icon"><Warehouse size={24}/></div><div><b>YABEI HARDWARE</b><small>PRIVATE BUSINESS STATUS</small></div></div>
      <div className="status-actions"><button className="secondary" onClick={() => void onRefresh()}><RefreshCw size={16}/> Refresh records</button><button className="secondary" onClick={onSignOut}><LogOut size={16}/> Sign out</button></div>
    </header>
    <main className="status-main">
      <div className="status-intro"><div><p className="eyebrow">OWNER VIEW · LIVE SAVED RECORDS</p><h1>Business status</h1><p>Read-only overview of YABEI Hardware. Changes made in the main management workspace appear here after refreshing.</p></div><a href="/?manage=1">Open management workspace</a></div>
      <section className="status-stats">
        <StatusCard icon={<Boxes/>} label="Products recorded" value={String(products.length)} note="Different stock items"/>
        <StatusCard icon={<Warehouse/>} label="Stock value" value={money(stockValue)} note="At recorded buying prices"/>
        <StatusCard icon={<CircleDollarSign/>} label="Sales revenue" value={money(revenue)} note="All saved sales"/>
        <StatusCard icon={<TrendingUp/>} label="Net profit / loss" value={money(netProfit)} note="After recorded expenses"/>
        <StatusCard icon={<Activity/>} label="Gross profit" value={money(grossProfit)} note="Sales less item cost"/>
        <StatusCard icon={<Users/>} label="Customer debts" value={money(debts)} note="Outstanding balances"/>
        <StatusCard icon={<AlertTriangle/>} label="Low-stock items" value={String(lowStock.length)} note="At or below reorder level"/>
        <StatusCard icon={<Wallet/>} label="M-Pesa recorded" value={money(tillTotal)} note={data.settings?.tillNumber ? 'Till ' + data.settings.tillNumber : 'Recorded till entries'}/>
        <StatusCard icon={<Receipt/>} label="Business expenses" value={money(expenseTotal)} note="All saved expenses"/>
      </section>
      <section className="status-panels">
        <article className="status-panel"><div className="status-panel-title"><div><h2>Current stock</h2><p>Available quantities and low-stock status</p></div><Boxes size={20}/></div><div className="status-table-wrap"><table><thead><tr><th>ITEM</th><th>QUANTITY</th><th>SELL PRICE</th><th>STATUS</th></tr></thead><tbody>{products.map(item => <tr key={item.id}><td><b>{item.name}</b><small>{item.sku || item.category}</small></td><td>{item.quantity} {item.unit}</td><td>{money(item.sellingPrice)}</td><td><span className={item.quantity <= item.reorderLevel ? 'status-pill low' : 'status-pill'}>{item.quantity <= item.reorderLevel ? 'Low stock' : 'In stock'}</span></td></tr>)}</tbody></table>{!products.length && <p className="status-empty">No stock records yet.</p>}</div></article>
        <article className="status-panel"><div className="status-panel-title"><div><h2>Recent sales</h2><p>Latest recorded transactions</p></div><Activity size={20}/></div><div className="status-rows">{recentSales.map(item => <div className="status-row" key={item.id}><div><b>{item.productName}</b><small>{new Date(item.createdAt).toLocaleString('en-KE')} · {item.customerName || 'Walk-in customer'}</small></div><strong>{money(item.total)}</strong></div>)}{!recentSales.length && <p className="status-empty">No sales recorded yet.</p>}</div></article>
        <article className="status-panel"><div className="status-panel-title"><div><h2>Customer balances</h2><p>Outstanding amounts</p></div><Users size={20}/></div><div className="status-rows">{(data.customers || []).map(customer => <div className="status-row" key={customer.id}><div><b>{customer.name}</b><small>{customer.phone || 'No phone recorded'}</small></div><strong>{money(customer.balance)}</strong></div>)}{!data.customers?.length && <p className="status-empty">No customer accounts yet.</p>}</div></article>
        <article className="status-panel"><div className="status-panel-title"><div><h2>M-Pesa and expenses</h2><p>Manually reconciled records saved in the system</p></div><Wallet size={20}/></div><div className="status-rows">{(data.tillPayments || []).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(payment => <div className="status-row" key={payment.id}><div><b>{payment.payer || payment.receipt}</b><small>{payment.receipt} · {new Date(payment.date).toLocaleDateString('en-KE')}</small></div><strong>{money(payment.amount)}</strong></div>)}{!data.tillPayments?.length && <p className="status-empty">No M-Pesa entries recorded yet.</p>}</div><div className="status-expenses">{expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(expense => <div className="status-row" key={expense.id}><div><b>{expense.title}</b><small>{expense.category} · {expense.date}</small></div><strong>{money(expense.amount)}</strong></div>)}</div></article>
      </section>
      <p className="status-footnote">Private owner dashboard · Values are calculated from records entered into YABEI Hardware and are not a direct bank or Safaricom feed.</p>
    </main>
  </div>;
}

function StatusCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article className="status-card"><div className="status-card-icon">{icon}</div><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}