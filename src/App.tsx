import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
type Product = { id: string; name: string; sku: string; buy: number; sell: number; qty: number; low: number; unit: string };
type Customer = { id: string; name: string; phone: string; balance: number };
type Sale = { id: string; date: string; customer: string; customerId?: string; total: number; paid: number; method: string; items: string; pickupStatus?: 'pending' | 'taken' };
type Expense = { id: string; date: string; description: string; amount: number };
type Employee = { username: string; pin: string; role: 'admin' | 'worker' };

const KEY = 'yabei-hardware-local-v1';
function parseQty(raw: string): number {
  const value = raw.trim().replace(/\s+/g, ' ');
  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = value.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[2]) ? Number(fraction[1]) / Number(fraction[2]) : NaN;
  return Number(value);
}
const money = (n: number) => `KSh ${Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
const uid = () => crypto.randomUUID();
const blankData = () => ({
  products: [] as Product[], customers: [] as Customer[], sales: [] as Sale[],
  expenses: [] as Expense[], employees: [{ username: 'admin', pin: '1234', role: 'admin' as const }] as Employee[]
});


export default function App() {
  const [data, setData] = useState(blankData);
  const [loaded, setLoaded] = useState(false);
  const [allowSave, setAllowSave] = useState(false);
  const [user, setUser] = useState<Employee | null>(null);
const [businessId, setBusinessId] = useState('');
  const [page, setPage] = useState('Overview');
  const [loginName, setLoginName] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [message, setMessage] = useState('');
  const [productForm, setProductForm] = useState({ name: '', sku: '', buy: '', sell: '', qty: '', low: '5', unit: 'pcs' });
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleProductId, setSaleProductId] = useState('');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [paymentCustomerId, setPaymentCustomerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [pickupLater, setPickupLater] = useState(false);
  const [clearChoice, setClearChoice] = useState('');
  const [saleMethod, setSaleMethod] = useState('Cash');
  const [salePaid, setSalePaid] = useState('');
  const [cart, setCart] = useState<{ productId: string; qty: string }[]>([]);
  const [employeeForm, setEmployeeForm] = useState({ username: '', pin: '', role: 'worker' as 'admin' | 'worker' });
  
useEffect(() => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      setData({ ...blankData(), ...JSON.parse(saved) });
    }
  } catch {
    setMessage('Saved browser data could not be read.');
  } finally {
    setLoaded(true);
  }
}, []);

useEffect(() => {
  if (!loaded) return;

  localStorage.setItem(KEY, JSON.stringify(data));
}, [data, loaded]);
 
  const isAdmin = user?.role === 'admin';
  const cartTotal = cart.reduce((sum, line) => {
    const p = data.products.find(x => x.id === line.productId);
    return sum + (p ? p.sell * Math.max(0, Number(line.qty) || 0) : 0);
  }, 0);
  const today = new Date().toLocaleDateString();
  const todaySales = data.sales.filter(s => new Date(s.date).toLocaleDateString() === today);
  const lowStock = data.products.filter(p => p.qty <= p.low);
  const debtTotal = data.customers.reduce((s, c) => s + c.balance, 0);
  const salesTotal = data.sales.reduce((s, x) => s + x.total, 0);
  const expenseTotal = data.expenses.reduce((s, x) => s + x.amount, 0);
  const estimatedProfit = data.sales.reduce((sum, sale) => sum + Number(sale.total) * 0.2, 0) - expenseTotal;

  async function login(e: React.FormEvent) {
  e.preventDefault();
  setMessage('Signing in...');

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: loginName.trim(),
      password: loginPin
    });

  if (authError || !authData.user) {
    setMessage(authError?.message || 'Sign in failed.');
    return;
  }

  const { data: member, error: memberError } = await supabase
    .from('business_members')
    .select('business_id, role')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (memberError || !member) {
    await supabase.auth.signOut();
    setMessage(memberError?.message || 'Your account is not linked to Yabei Hardware.');
    return;
  }

  const business = member.business_id;

  const [
    { data: products, error: productsError },
    { data: customers, error: customersError },
    { data: sales, error: salesError },
    { data: saleItems, error: itemsError },
    { data: expenses, error: expensesError }
  ] = await Promise.all([
    supabase.from('products').select('*').eq('business_id', business),
    supabase.from('customers').select('*').eq('business_id', business),
    supabase.from('sales').select('*').eq('business_id', business),
    supabase.from('sale_items').select('*').eq('business_id', business),
    supabase.from('expenses').select('*').eq('business_id', business)
  ]);

  if (productsError || customersError || salesError || itemsError || expensesError) {
    await supabase.auth.signOut();
    setMessage(
      productsError?.message ||
      customersError?.message ||
      salesError?.message ||
      itemsError?.message ||
      expensesError?.message ||
      'Could not load business records.'
    );
    return;
  }

  const productList = (products || []).map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku || '',
    buy: Number(p.buying_price) || 0,
    sell: Number(p.selling_price) || 0,
    qty: Number(p.quantity) || 0,
    low: Number(p.low_stock_level) || 0,
    unit: p.unit || 'pcs'
  }));

  const customerList = (customers || []).map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone || '',
    balance: (sales || [])
      .filter(s => s.customer_id === c.id)
      .reduce(
        (total, s) => total + Math.max(
          0,
          Number(s.total_amount || 0) - Number(s.amount_paid || 0)
        ),
        0
      )
  }));

  const productNames = new Map(productList.map(p => [p.id, p.name]));

  const saleList = (sales || []).map(s => ({
    id: s.id,
    date: s.created_at,
    customer: customerList.find(c => c.id === s.customer_id)?.name || 'Walk-in customer',
    customerId: s.customer_id || undefined,
    total: Number(s.total_amount) || 0,
    paid: Number(s.amount_paid) || 0,
    method: s.payment_method || 'Cash',
    items: (saleItems || [])
      .filter(i => i.sale_id === s.id)
      .map(i => `${productNames.get(i.product_id) || 'Product'} × ${i.quantity}`)
      .join(', '),
    pickupStatus: s.pickup_status === 'taken' ? 'taken' as const : 'pending' as const
  }));

  const expenseList = (expenses || []).map(x => ({
    id: x.id,
    date: x.created_at,
    description: x.description,
    amount: Number(x.amount) || 0
  }));

  setData({
    products: productList,
    customers: customerList,
    sales: saleList,
    expenses: expenseList,
    employees: []
  });

  setBusinessId(business);

  setUser({
    username: authData.user.email || loginName.trim(),
    pin: '',
    role: member.role === 'owner' || member.role === 'admin' ? 'admin' : 'worker'
  });

  setMessage('Welcome to Yabei Hardware. Cloud records loaded.');
}

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();

    if (!productForm.name.trim()) {
      return setMessage('Enter a product name.');
    }

    if (!businessId) {
      return setMessage('Please sign in again before saving products.');
    }

    setMessage('Saving product to Supabase...');

    const { data: savedProduct, error } = await supabase
      .from('products')
      .insert({
        business_id: businessId,
        name: productForm.name.trim(),
        sku: productForm.sku.trim(),
        buying_price: Number(productForm.buy) || 0,
        selling_price: Number(productForm.sell) || 0,
        quantity: Number(productForm.qty) || 0,
        low_stock_level: Number(productForm.low) || 0,
        unit: productForm.unit || 'pcs'
      })
      .select()
      .single();

    if (error || !savedProduct) {
      setMessage(error?.message || 'Product could not be saved.');
      return;
    }

    setData(d => ({
      ...d,
      products: [...d.products, {
        id: savedProduct.id,
        name: savedProduct.name,
        sku: savedProduct.sku || '',
        buy: Number(savedProduct.buying_price) || 0,
        sell: Number(savedProduct.selling_price) || 0,
        qty: Number(savedProduct.quantity) || 0,
        low: Number(savedProduct.low_stock_level) || 0,
        unit: savedProduct.unit || 'pcs'
      }]
    }));

    setProductForm({ name: '', sku: '', buy: '', sell: '', qty: '', low: '5', unit: 'pcs' });
    setMessage('Product successfully saved to Supabase.');
  }
  function saveSale() {
    if (!cart.length) return setMessage('Add at least one item to the sale.');
    const lines = cart.map(line => ({ p: data.products.find(p => p.id === line.productId), qty: parseQty(line.qty) }));
    if (lines.some(x => !x.p || !Number.isFinite(x.qty) || x.qty <= 0)) return setMessage('Check the product and quantity entries.');
    const quantitiesByProduct = new Map<string, number>();
    lines.forEach(x => { if (x.p) quantitiesByProduct.set(x.p.id, (quantitiesByProduct.get(x.p.id) || 0) + x.qty); });
    for (const [productId, requested] of quantitiesByProduct) {
      const product = data.products.find(p => p.id === productId);
      if (!product || requested > product.qty) return setMessage(`Only ${product?.qty ?? 0} ${product?.unit ?? ''} available for ${product?.name ?? 'this product'}.`);
    }
    const total = lines.reduce((sum, x) => sum + (x.p ? x.p.sell * x.qty : 0), 0);
    const paidInput = salePaid.trim() === '' ? total : Number(salePaid);
    if (!Number.isFinite(paidInput) || paidInput < 0) return setMessage('Enter a valid amount paid.');
    const paid = Math.min(total, paidInput);
    const customer = data.customers.find(c => c.id === saleCustomer);
    const items = lines.map(x => `${x.p!.name} Ã— ${x.qty} ${x.p!.unit} @ ${money(x.p!.sell)}`).join(', ');
    const saleRecord: Sale = { id: uid(), date: new Date().toISOString(), customer: customer?.name || 'Walk-in customer', customerId: customer?.id, total, paid, method: paid === total ? 'Paid' : 'Part-paid / credit', items, pickupStatus: pickupLater ? 'pending' : 'taken' };
    setData(d => ({
      ...d,
      products: d.products.map(p => ({ ...p, qty: p.qty - (quantitiesByProduct.get(p.id) || 0) })),
      customers: customer && paid < total
        ? d.customers.map(c => c.id === customer.id ? { ...c, balance: c.balance + total - paid } : c)
        : d.customers,
      sales: [saleRecord, ...d.sales]
    }));
    setCart([]); setSalePaid(''); setSaleCustomer(''); setSaleProductId(''); setSaleQuantity('1'); setPickupLater(false);
    setMessage(`Sale saved. Total ${money(total)}; paid ${money(paid)}; balance ${money(total - paid)}.`);
  }
  function recordCustomerPayment(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(paymentAmount);
    const customer = data.customers.find(c => c.id === paymentCustomerId);
    if (!customer) return setMessage('Choose a saved customer.');
    if (!Number.isFinite(amount) || amount <= 0) return setMessage('Enter a valid payment amount.');
    if (amount > customer.balance) return setMessage('Payment cannot exceed the customer debt.');
    let remaining = amount;
    setData(d => ({
      ...d,
      customers: d.customers.map(c => c.id === customer.id ? { ...c, balance: Math.max(0, c.balance - amount) } : c),
      sales: d.sales.map(s => {
        if (s.customerId !== customer.id || remaining <= 0) return s;
        const due = Math.max(0, s.total - s.paid);
        const applied = Math.min(due, remaining);
        remaining -= applied;
        return { ...s, paid: s.paid + applied, method: 'Customer payment' };
      })
    }));
    setPaymentAmount('');
    setMessage(`Payment of ${money(amount)} recorded for ${customer.name}. Remaining debt: ${money(customer.balance - amount)}.`);
  }
  function editCustomerDebt(customerId: string) {
    const customer = data.customers.find(c => c.id === customerId);
    if (!customer) return;
    const raw = window.prompt(`Edit outstanding debt for ${customer.name} (KSh):`, String(customer.balance));
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return setMessage('Enter a valid debt amount.');
    setData(d => ({ ...d, customers: d.customers.map(c => c.id === customerId ? { ...c, balance: amount } : c) }));
    setMessage(`Outstanding debt updated for ${customer.name}.`);
  }
  function markTaken(saleId: string) {
    setData(d => ({ ...d, sales: d.sales.map(s => s.id === saleId ? { ...s, pickupStatus: 'taken' } : s) }));
    setMessage('Sale marked as taken by customer.');
  }
  function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerForm.name.trim()) return setMessage('Enter customer name.');
    setData(d => ({ ...d, customers: [...d.customers, { id: uid(), name: customerForm.name.trim(), phone: customerForm.phone.trim(), balance: 0 }] }));
    setCustomerForm({ name: '', phone: '' }); setMessage('Customer added.');
  }
  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseForm.description.trim() || Number(expenseForm.amount) <= 0) return setMessage('Enter expense details and amount.');
    setData(d => ({ ...d, expenses: [{ id: uid(), date: new Date().toISOString(), description: expenseForm.description.trim(), amount: Number(expenseForm.amount) }, ...d.expenses] }));
    setExpenseForm({ description: '', amount: '' }); setMessage('Expense saved.');
  }
  function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeForm.username.trim() || employeeForm.pin.length < 4) return setMessage('Enter a username and a PIN of at least 4 characters.');
    if (data.employees.some(x => x.username.toLowerCase() === employeeForm.username.trim().toLowerCase())) return setMessage('That username already exists.');
    setData(d => ({ ...d, employees: [...d.employees, { ...employeeForm, username: employeeForm.username.trim() }] }));
    setEmployeeForm({ username: '', pin: '', role: 'worker' }); setMessage('Employee account created.');
  }
  function downloadBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'yabei-hardware-backup.json'; a.click(); URL.revokeObjectURL(url);
  }

  if (!loaded) return <main style={styles.center}>Loading Yabei Hardwareâ€¦</main>;
  if (!user) return <main style={styles.loginWrap}>
    <form onSubmit={login} style={styles.login}>
      <div style={styles.logo}>YH</div><h1>YABEI HARDWARE</h1><p style={styles.muted}>Store management system</p>
     <label>Email address</label>
<input
  type="email"
  value={loginName}
  onChange={e => setLoginName(e.target.value)}
  placeholder="Enter your email"
  required
/>
<label>Password</label>
<input
  type="password"
  value={loginPin}
  onChange={e => setLoginPin(e.target.value)}
  placeholder="Enter your password"
  required
/>
<button style={styles.primary}>Sign in</button>
      {message && <p>{message}</p>}
    </form>
  </main>;
 
  const nav = ['Overview', 'Stock', 'New Sale', 'Sales', 'Customers', 'Expenses', 'Reports', 'Employees', 'Settings'];
  return <div style={styles.app}>
    <header style={styles.header}><div><b>YABEI HARDWARE</b><small>Store management</small></div><div>{user.username} Â· {user.role}<button style={styles.logout} onClick={() => { setUser(null); setPage('Overview'); }}>Sign out</button></div></header>
    <nav style={styles.nav}>{nav.filter(n => n !== 'Employees' || isAdmin).map(n => <button key={n} onClick={() => setPage(n)} style={{ ...styles.navButton, ...(page === n ? styles.active : {}) }}>{n}</button>)}</nav>
    <main style={styles.main}>
      {message && <div style={styles.message}>{message}<button onClick={() => setMessage('')}>Ã—</button></div>}
      {page === 'Overview' && <><h2>Overview</h2><div style={styles.cards}>
        <Metric title="Today's sales" value={money(todaySales.reduce((s, x) => s + x.total, 0))}/>
        <Metric title="Sales count today" value={String(todaySales.length)}/>
        <Metric title="Products" value={String(data.products.length)}/>
        <Metric title="Customer debts" value={money(debtTotal)}/>
        <Metric title="Estimated profit" value={money(estimatedProfit)}/>
        <Metric title="Low-stock items" value={String(lowStock.length)}/>
      </div><h3>Low-stock alerts</h3>{lowStock.length ? <ul>{lowStock.map(p => <li key={p.id}>{p.name}: {p.qty} {p.unit} remaining (alert at {p.low})</li>)}</ul> : <p style={styles.muted}>No low-stock alerts.</p>}</>}
      {page === 'Stock' && <><h2>Stock</h2><form onSubmit={addProduct} style={styles.formGrid}>
        <input placeholder="Product name" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })}/>
        <input placeholder="SKU (optional)" value={productForm.sku} onChange={e => setProductForm({ ...productForm, sku: e.target.value })}/>
        <input type="number" min="0" placeholder="Buying price" value={productForm.buy} onChange={e => setProductForm({ ...productForm, buy: e.target.value })}/>
        <input type="number" min="0" placeholder="Selling price" value={productForm.sell} onChange={e => setProductForm({ ...productForm, sell: e.target.value })}/>
        <input type="number" min="0" step="0.01" placeholder="Opening quantity" value={productForm.qty} onChange={e => setProductForm({ ...productForm, qty: e.target.value })}/>
        <input type="number" min="0" placeholder="Low-stock level" value={productForm.low} onChange={e => setProductForm({ ...productForm, low: e.target.value })}/>
        <input placeholder="Unit (pcs, bags, metres)" value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value })}/>
        <button style={styles.primary}>Add product</button>
      </form><DataTable headers={['Product', 'SKU', 'Buying', 'Selling', 'Quantity', 'Alert']} rows={data.products.map(p => [p.name, p.sku || 'â€”', money(p.buy), money(p.sell), `${p.qty} ${p.unit}`, String(p.low)])}/>
      {isAdmin && <div style={styles.list}>{data.products.map(p => <button key={p.id} style={styles.danger} onClick={() => setData(d => ({ ...d, products: d.products.filter(x => x.id !== p.id) }))}>Delete {p.name}</button>)}</div>}</>}
      {page === 'New Sale' && <><h2>New sale</h2>
        <div style={styles.formGrid}>
          <label>Customer<select value={saleCustomer} onChange={e => setSaleCustomer(e.target.value)}><option value="">Walk-in customer</option>{data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Choose product<select value={saleProductId} onChange={e => setSaleProductId(e.target.value)}><option value="">Choose product</option>{data.products.map(p => <option key={p.id} value={p.id}>{p.name} â€” {money(p.sell)} ({p.qty} {p.unit} available)</option>)}</select></label>
          <label>Quantity (e.g. 2, 1/2, 2 1/2)<input type="text" value={saleQuantity} onChange={e => setSaleQuantity(e.target.value)} placeholder="Enter quantity or fraction"/></label>
          <label>Unit from Stock<input readOnly value={data.products.find(p => p.id === saleProductId)?.unit || 'Select a product first'} /></label>
          <button type="button" onClick={() => {
            const selected = data.products.find(p => p.id === saleProductId);
            const q = parseQty(saleQuantity);
            if (!selected) return setMessage('Choose a product first.');
            if (!Number.isFinite(q) || q <= 0) return setMessage('Enter a valid quantity.');
            const alreadyInCart = cart.filter(x => x.productId === selected.id).reduce((sum, x) => sum + Number(x.qty), 0);
            if (alreadyInCart + q > selected.qty) return setMessage(`Only ${selected.qty - alreadyInCart} ${selected.unit} more available for ${selected.name}.`);
            setCart(c => [...c, { productId: selected.id, qty: String(q) }]);
            setSaleProductId(''); setSaleQuantity('1');
            setMessage(`${selected.name} added.`);
          }}>Add item</button>
        </div>
        <h3>Items added</h3>
        <ul>{cart.map((line, i) => { const p = data.products.find(x => x.id === line.productId); return <li key={i}>{p?.name} â€” {line.qty} {p?.unit} Ã— {money(p?.sell || 0)} = <b>{money((p?.sell || 0) * Number(line.qty))}</b> <button type="button" onClick={() => setCart(c => c.filter((_, j) => j !== i))}>Remove</button></li>; })}</ul>
        <section style={styles.metric}><small>SALE TOTAL</small><strong style={{ fontSize: 28 }}>{money(cartTotal)}</strong></section>
        <label><input type="checkbox" checked={pickupLater} onChange={e => setPickupLater(e.target.checked)}/> Customer will pick up later</label><label>Amount paid<input type="number"  min="0" step="0.01" max={cartTotal} placeholder="Enter amount paid (leave blank for full payment)" value={salePaid} onChange={e => setSalePaid(e.target.value)}/></label>
        <button type="button" style={styles.primary} disabled={!cart.length} onClick={saveSale}>Save sale</button>
      </>}
      {page === 'Sales' && <><h2>Sales history</h2><DataTable headers={['Date', 'Customer', 'Items', 'Total', 'Paid', 'Balance', 'Method', 'Pickup']} rows={data.sales.map(s => [new Date(s.date).toLocaleString(), s.customer, s.items, money(s.total), money(s.paid), money(s.total - s.paid), s.method, s.pickupStatus === 'taken' ? 'Taken' : 'Waiting'])}/></>}
      {page === 'Customers' && <><h2>Customers, debts and collections</h2><form onSubmit={addCustomer} style={styles.formGrid}><input placeholder="Customer name" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}/><input placeholder="Phone (optional)" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}/><button style={styles.primary}>Add customer</button></form><h3>Record customer debt payment</h3><form onSubmit={recordCustomerPayment} style={styles.formGrid}><select value={paymentCustomerId} onChange={e => setPaymentCustomerId(e.target.value)}><option value="">Choose customer</option>{data.customers.filter(c => c.balance > 0).map(c => <option key={c.id} value={c.id}>{c.name} â€” owes {money(c.balance)}</option>)}</select><input type="number" min="0.01" step="0.01" placeholder="Amount received" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}/><button style={styles.primary}>Record payment</button></form><h3>Customer balances</h3><DataTable headers={['Name', 'Phone', 'Amount owed']} rows={data.customers.map(c => [c.name, c.phone, money(c.balance)])}/><div>{data.customers.map(c => <button key={c.id} type="button" onClick={() => editCustomerDebt(c.id)}>Edit debt: {c.name}</button>)}</div><h3>Unpaid items</h3><DataTable headers={['Customer', 'Items', 'Total', 'Paid', 'Still owed']} rows={data.sales.filter(s => s.total > s.paid).map(s => [s.customer, s.items, money(s.total), money(s.paid), money(s.total - s.paid)])}/><h3>Waiting for customer pickup</h3><DataTable headers={['Customer', 'Items', 'Sale date', 'Status']} rows={data.sales.filter(s => s.pickupStatus !== 'taken').map(s => [s.customer, s.items, new Date(s.date).toLocaleString(), <button type="button" onClick={() => markTaken(s.id)}>Mark taken</button> as unknown as string])}/></>}
      {page === 'Expenses' && <><h2>Expenses</h2><form onSubmit={addExpense} style={styles.formGrid}><input placeholder="Expense description" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}/><input type="number" min="0.01" placeholder="Amount (KSh)" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}/><button style={styles.primary}>Save expense</button></form><DataTable headers={['Date', 'Description', 'Amount']} rows={data.expenses.map(x => [new Date(x.date).toLocaleString(), x.description, money(x.amount)])}/></>}
      {page === 'Reports' && <><h2>Reports</h2><div style={styles.cards}><Metric title="All-time sales" value={money(salesTotal)}/><Metric title="Expenses" value={money(expenseTotal)}/><Metric title="Estimated net profit*" value={money(estimatedProfit)}/><Metric title="Customer balances" value={money(debtTotal)}/></div><p style={styles.muted}>*Profit is a rough estimate using 20% of sales less recorded expenses. It is not an exact profit calculation.</p></>}
      {page === 'Employees' && isAdmin && <><h2>Employee accounts</h2><form onSubmit={addEmployee} style={styles.formGrid}><input placeholder="Username" value={employeeForm.username} onChange={e => setEmployeeForm({ ...employeeForm, username: e.target.value })}/><input placeholder="PIN (at least 4 characters)" value={employeeForm.pin} onChange={e => setEmployeeForm({ ...employeeForm, pin: e.target.value })}/><select value={employeeForm.role} onChange={e => setEmployeeForm({ ...employeeForm, role: e.target.value as 'admin' | 'worker' })}><option value="worker">Worker</option><option value="admin">Admin</option></select><button style={styles.primary}>Create account</button></form><ul>{data.employees.map(x => <li key={x.username}>{x.username} â€” {x.role}</li>)}</ul></>}
      {page === 'Settings' && <><h2>Settings and backup</h2><p>Data is saved only in this browser on this device. It is not yet shared between phones or computers.</p><button style={styles.primary} onClick={downloadBackup}>Download data backup</button><h3>Clear unnecessary records</h3><p>Download a backup before clearing records. This action cannot be undone.</p><select value={clearChoice} onChange={e => setClearChoice(e.target.value)}><option value="">Choose records to clear</option><option value="sales">Sales history</option><option value="expenses">Expenses</option><option value="taken">Items already marked taken</option></select><button type="button" style={styles.danger} disabled={!clearChoice} onClick={() => { if (!window.confirm('Are you sure? This cannot be undone.')) return; if (clearChoice === 'sales') setData(d => ({ ...d, sales: [] })); if (clearChoice === 'expenses') setData(d => ({ ...d, expenses: [] })); if (clearChoice === 'taken') setData(d => ({ ...d, sales: d.sales.filter(x => x.pickupStatus !== 'taken') })); setClearChoice(''); setMessage('Selected records cleared.'); }}>Clear selected records</button><p style={styles.muted}>M-Pesa is only recorded as a payment label here. No payment is sent or verified.</p><p style={styles.muted}>For a real shop, use a secure server and proper staff authentication before storing business records.</p></>}
    </main>
    <footer style={styles.footer}>Yabei Hardware Â· Local starter version Â· Currency: KSh</footer>
  </div>;
}

function Metric({ title, value }: { title: string; value: string }) {
  return <section style={styles.metric}><small>{title}</small><strong>{value}</strong></section>;
}
function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return <div style={{ overflowX: 'auto' }}><table style={styles.table}><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>) : <tr><td colSpan={headers.length}>No records yet.</td></tr>}</tbody></table></div>;
}

const styles: Record<string, React.CSSProperties> = {
  app: { minHeight: '100vh', background: '#f3f6f4', color: '#17251d', fontFamily: 'Arial, sans-serif' },
  center: { minHeight: '100vh', display: 'grid', placeItems: 'center' },
  loginWrap: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#102c20,#286343)', padding: 20, fontFamily: 'Arial,sans-serif' },
  login: { background: 'white', padding: 32, borderRadius: 16, width: 'min(100%,380px)', display: 'grid', gap: 12, boxShadow: '0 15px 50px #0003' },
  logo: { width: 54, height: 54, borderRadius: 14, background: '#1f7547', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 22 },
  muted: { color: '#66756b', fontSize: 13 },
  header: { background: '#123b28', color: 'white', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 15 },
  nav: { display: 'flex', gap: 6, flexWrap: 'wrap', padding: 12, background: 'white', borderBottom: '1px solid #dce5de' },
  navButton: { border: 0, padding: '10px 13px', borderRadius: 8, background: '#eef3ef', cursor: 'pointer' },
  active: { background: '#1e7044', color: 'white' },
  main: { maxWidth: 1200, margin: 'auto', padding: 22 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 },
  metric: { background: 'white', padding: 18, borderRadius: 12, display: 'grid', gap: 10, boxShadow: '0 2px 8px #142d1c0c' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, margin: '16px 0' },
  primary: { background: '#1d7044', color: 'white', border: 0, padding: '12px 16px', borderRadius: 8, cursor: 'pointer' },
  logout: { marginLeft: 12, padding: '7px 10px', borderRadius: 7, border: 0, cursor: 'pointer' },
  message: { background: '#e5f4e9', padding: 12, borderRadius: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', marginTop: 16 },
  danger: { background: '#a52d2d', color: 'white', border: 0, padding: 8, borderRadius: 6, margin: 4, cursor: 'pointer' },
  list: { marginTop: 12 },
  footer: { textAlign: 'center', padding: 20, color: '#718078', fontSize: 12 }
};



