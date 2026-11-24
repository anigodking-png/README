import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import { Search, Package, ShieldCheck, Users, Activity } from 'lucide-react';

type PublicProduct = {
  name: string;
  sku?: string;
  category?: string;
  unit?: string;
  sellingPrice: number;
  imageUrl?: string;
  available: boolean;
};

const money = (value: number) => new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0
}).format(value || 0);

export default function PublicStorefront() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/public-products')
      .then(response => setProducts(response.data?.products || []))
      .catch(() => setError('The catalogue is temporarily unavailable. Please refresh shortly.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => products.filter(product =>
    [product.name, product.sku || '', product.category || '']
      .join(' ').toLowerCase().includes(search.toLowerCase())
  ), [products, search]);

  return <div className="public-store">
    <header className="public-header">
      <div className="public-brand">
        <div className="public-brand-mark">
          <img src="/resources/yabei-app-icon.png" alt="" />
        </div>
        <div>
          <b>YABEI HARDWARE</b>
          <small>STORE MANAGEMENT PORTAL</small>
        </div>
      </div>
      <nav className="public-header-links" aria-label="Store access">
        <a className="status-link" href="/?status=1">Business status</a>
      </nav>
    </header>

    <section className="public-hero">
      <p className="eyebrow">WELCOME TO YABEI HARDWARE</p>
      <h1>Your store workspace, all in one place.</h1>
      <p>Choose the correct secure workspace to continue. Administrator access is reserved for the authorised owner account; staff sign in with their own verified accounts.</p>

      <div className="home-access-grid">
        <a className="home-access-card" href="/?manage=1">
          <span><ShieldCheck size={24}/></span>
          <b>Admin sign in</b>
          <small>Manage stock, sales, reports, settings and business performance.</small>
          <strong>Open admin workspace →</strong>
        </a>
        <a className="home-access-card" href="/?manage=1">
          <span><Users size={24}/></span>
          <b>Worker sign in</b>
          <small>Prepare customer worksheets, record debts and register customers.</small>
          <strong>Open worker workspace →</strong>
        </a>
        <a className="home-access-card" href="/?status=1">
          <span><Activity size={24}/></span>
          <b>Business status</b>
          <small>Open the business progress dashboard. Sign-in remains required to protect sales, debts and profit information.</small>
          <strong>View status →</strong>
        </a>
      </div>
    </section>

    <main className="public-catalogue">
      <div className="public-catalogue-head">
        <div>
          <h2>Product catalogue</h2>
          <p className="muted">{products.length} listed products</p>
        </div>
        <label className="public-search">
          <Search size={17}/>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
          />
        </label>
      </div>

      {loading && <div className="public-state">Loading product catalogue…</div>}
      {error && <div className="public-state">{error}</div>}
      {!loading && !error && !filtered.length && (
        <div className="public-state">
          {search ? 'No products match that search.' : 'The product catalogue is being prepared. Please check again soon.'}
        </div>
      )}

      <div className="public-product-grid">
        {filtered.map((product, index) => (
          <article className="public-product" key={product.sku || product.name + index}>
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.name} loading="lazy"/>
              : <div className="public-product-placeholder"><Package size={30}/></div>}
            <div className="public-product-body">
              <h3>{product.name}</h3>
              <p>{[product.category, product.unit].filter(Boolean).join(' · ')}</p>
              <strong className="public-product-price">{money(product.sellingPrice)}</strong>
            </div>
          </article>
        ))}
      </div>
    </main>

    <footer className="public-footer">
      © {new Date().getFullYear()} YABEI HARDWARE · Currency: KSh.
    </footer>
  </div>;
}