import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown,
  CreditCard, Edit3, Eye, EyeOff, ImagePlus, LayoutDashboard, LockKeyhole,
  LogOut, Menu, Minus, Package, Plus, Search, Settings, ShieldCheck,
  ShoppingBag, SlidersHorizontal, Sparkles, Trash2, Truck, UploadCloud, X
} from 'lucide-react';
import './styles.css';

const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
const request = async (url, init = {}) => {
  const headers = init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const r = await fetch(url, { credentials: 'same-origin', ...init, headers: { ...headers, ...(init.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status}).`);
  return data;
};
const blankProduct = { name: '', category: 'General merchandise', description: '', price: '', stock: 10, image: '', color: '#eeeee9', active: true, featured: false };
const categoriesSeed = ['All products', 'General merchandise', 'Wholesale cases', 'Closeout lots', 'Pallet quantities', 'Business supplies', 'Electronics'];

function App() {
  const [view, setView] = useState(location.pathname.startsWith('/admin') ? 'admin' : 'shop');
  const [products, setProducts] = useState([]);
  const [config, setConfig] = useState(null);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('catalog_cart') || '{}'); } catch { return {}; } });
  const [cartOpen, setCartOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All products');
  const [sort, setSort] = useState('featured');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [adminTab, setAdminTab] = useState('overview');
  const [editor, setEditor] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const notify = msg => { setNotice(msg); window.setTimeout(() => setNotice(''), 3500); };
  const refresh = async () => {
    const [p, c] = await Promise.all([request('/api/products'), request('/api/config')]);
    setProducts(p); setConfig(c);
  };
  const refreshAdmin = async () => {
    const d = await request('/api/admin/data');
    setAdminData(d);
    await refresh();
  };
  useEffect(() => {
    Promise.all([refresh(), request('/api/admin/me')]).then(([, a]) => setAdmin(a.admin)).catch(e => notify(e.message)).finally(() => setLoading(false));
    const params = new URLSearchParams(location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      setCart({});
      setCheckoutMessage('Payment submitted. We’re verifying your payment; your order is confirmed once Stripe reports it as paid.');
    } else if (checkout === 'cancelled') setCheckoutMessage('Checkout was cancelled. Your cart is still here whenever you’re ready.');
    if (checkout) window.history.replaceState({}, '', location.pathname);
    const handler = () => setView(location.pathname.startsWith('/admin') ? 'admin' : 'shop');
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  useEffect(() => { localStorage.setItem('catalog_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { if (admin && view === 'admin') refreshAdmin().catch(e => notify(e.message)); }, [admin, view]);

  const navigate = page => { setView(page); window.history.pushState({}, '', page === 'admin' ? '/admin' : '/'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cartCount = Object.values(cart).reduce((n, qty) => n + qty, 0);
  const cartItems = Object.entries(cart).map(([id, quantity]) => ({ product: products.find(p => p.id === id), quantity })).filter(x => x.product);
  const cartTotal = cartItems.reduce((total, x) => total + x.product.priceCents * x.quantity, 0);
  const changeQuantity = (product, step) => setCart(old => {
    const next = { ...old }, qty = Math.min(product.stock, Math.max(0, (next[product.id] || 0) + step));
    if (qty === 0) delete next[product.id]; else next[product.id] = qty;
    return next;
  });
  const addToCart = product => {
    if (product.stock <= 0) return notify('This item is sold out.');
    if ((cart[product.id] || 0) >= product.stock) return notify('You have the available stock in your bag.');
    changeQuantity(product, 1); setDetail(null); setCartOpen(true);
  };
  const categories = useMemo(() => ['All products', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = products.filter(p => (category === 'All products' || p.category === category) && (!q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q)));
    if (sort === 'low') list.sort((a,b) => a.priceCents - b.priceCents);
    if (sort === 'high') list.sort((a,b) => b.priceCents - a.priceCents);
    if (sort === 'newest') list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === 'featured') list.sort((a,b) => Number(b.featured) - Number(a.featured));
    return list;
  }, [products, category, search, sort]);
  const featured = products.find(p => p.featured) || products[0];
  const s = config?.settings || { name: 'M&M Wholesale & Liquidation', headline: 'Big inventory. Better deals.', tagline: 'Wholesale cases and pallet quantities for business buyers.', eyebrow: 'WHOLESALE · CLOSEOUTS · PALLETS', announcement: 'BULK DEALS · COMPETITIVE PRICES · RELIABLE SUPPLY' };

  const checkout = async () => {
    if (!config?.stripeEnabled) return notify('Stripe checkout is not connected yet.');
    try {
      setSaveBusy(true);
      const result = await request('/api/checkout', { method: 'POST', body: JSON.stringify({ items: cartItems.map(({product, quantity}) => ({ id: product.id, quantity })) }) });
      window.location.assign(result.url);
    } catch (e) { notify(e.message); } finally { setSaveBusy(false); }
  };
  const login = async password => { await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }); setAdmin(true); notify('Welcome back.'); };
  const logout = async () => { await request('/api/admin/logout', { method: 'POST' }); setAdmin(false); setAdminData(null); navigate('shop'); };
  const saveProduct = async product => {
    setSaveBusy(true);
    try {
      const payload = { ...product, priceCents: Math.round(Number(product.price) * 100), stock: Number(product.stock) };
      delete payload.price;
      await request(product.id ? `/api/admin/products/${product.id}` : '/api/admin/products', { method: product.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setEditor(null); await refreshAdmin(); notify(product.id ? 'Product updated.' : 'Product added to your catalog.');
    } catch (e) { notify(e.message); } finally { setSaveBusy(false); }
  };
  const deleteProduct = async p => {
    if (!confirm(`Delete “${p.name}” from your catalog?`)) return;
    try { await request(`/api/admin/products/${p.id}`, { method: 'DELETE' }); await refreshAdmin(); notify('Product deleted.'); } catch (e) { notify(e.message); }
  };
  const editProduct = p => setEditor({ ...p, price: (p.priceCents / 100).toFixed(2) });
  const clearDemos = async () => {
    if (!confirm('Remove all remaining sample items? This cannot be undone.')) return;
    try { await request('/api/admin/demo-products', { method: 'DELETE' }); await refreshAdmin(); notify('Sample items removed.'); } catch (e) { notify(e.message); }
  };

  if (loading) return <div className="loading-screen"><div className="loading-mark">M<span>&</span>M</div><p>Preparing your shop</p></div>;
  return <>
    {view === 'shop' ? <>
      <div className="announcement"><Sparkles size={13} /> {s.announcement || 'Discover your new favorite things.'} <ArrowRight size={13}/></div>
      <header className="site-header"><div className="header-inner">
        <button className="brand" onClick={() => { navigate('shop'); setCategory('All products'); setSearch(''); }}><span className="brand-logo">M<span>&</span>M</span><span className="brand-name">{s.name}</span></button>
        <nav className="header-nav"><a href="#collection">Shop all</a><a href="#story">Why M&M</a><button onClick={() => navigate('admin')}>Seller dashboard</button></nav>
        <div className="header-actions"><button className="icon-button search-top" aria-label="Go to search" onClick={() => document.getElementById('product-search')?.focus()}><Search size={20}/></button><button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Shopping bag with ${cartCount} items`}><ShoppingBag size={20}/><span className="bag-label">Bag</span><span className="bag-count">{cartCount}</span></button><button className="icon-button mobile-admin" onClick={() => navigate('admin')} aria-label="Seller dashboard"><Menu size={23}/></button></div>
      </div></header>
      {checkoutMessage && <div className="checkout-banner"><Check size={20}/><span>{checkoutMessage}</span><button aria-label="Dismiss" onClick={() => setCheckoutMessage(null)}><X size={16}/></button></div>}
      {config?.demoProducts > 0 && <div className="demo-notice"><span>PREVIEW STORE</span> These are example products. Open the <button onClick={() => navigate('admin')}>seller dashboard <ArrowUpRight size={13}/></button> to add your own.</div>}
      <main>
        <section className="hero page-container"><div className="hero-copy"><div className="eyebrow"><span className="dot"/>{s.eyebrow}</div><h1>{s.headline}</h1><p>{s.tagline}</p><a className="primary-btn hero-btn" href="#collection">Browse inventory <ArrowUpRight size={19}/></a><div className="hero-footer"><span><span className="mini-line"/> BUILT FOR BUSINESS</span><span>B2B / WHOLESALE</span></div></div><div className="hero-art"><div className="hero-art-tag">BULK DEALS · CLOSEOUTS <span>—</span> 2026</div>{featured ? <img className="mm-hero-logo" src="/mm-logo.jpeg" alt="M&M Wholesale & Liquidation company logo" /> : <div className="hero-empty">Your collection starts here.</div>}<div className="hero-art-bottom"><div><span>WHOLESALE INVENTORY</span><strong>Cases · Pallets · Closeouts</strong></div><span className="hero-ellipse">↗</span></div></div></section>
        <section className="qualities page-container" id="story"><div><ShieldCheck size={22}/><span>Business-to-business supply</span></div><div><Package size={22}/><span>Cases, lots & pallet quantities</span></div><div><Truck size={22}/><span>Competitive bulk pricing</span></div></section>
        <section className="collection page-container" id="collection"><div className="section-heading"><div><div className="eyebrow small">SHOP WHOLESALE</div><h2>Browse available deals.</h2></div><div className="collection-summary">{products.length} listings to explore <ArrowDown size={18}/></div></div>
        <div className="catalog-layout"><aside className={`filters ${mobileFilters ? 'visible' : ''}`}><div className="sidebar-head"><h3>Categories</h3><button className="mobile-only" onClick={() => setMobileFilters(false)}><X size={20}/></button></div><div className="category-list">{categories.map(cat => <button key={cat} className={cat === category ? 'active' : ''} onClick={() => { setCategory(cat); setMobileFilters(false); }}><span>{cat}</span>{cat === category && <ArrowUpRight size={16}/>}</button>)}</div><div className="sidebar-card"><div className="star-mark">✳</div><strong>Buy more. Spend smarter.</strong><p>Explore closeouts, mixed lots and everyday merchandise at wholesale prices.</p></div></aside>
        <div className="products-area"><div className="products-toolbar"><div className="search-field"><Search size={18}/><input id="product-search" placeholder="Search bulk inventory..." value={search} onChange={e => setSearch(e.target.value)}/>{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={15}/></button>}</div><button className="filter-toggle" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={17}/> Filters</button><div className="sort-holder"><span>Sort by</span><select aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured</option><option value="newest">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select><ChevronDown size={15}/></div></div>
        {filtered.length === 0 ? <div className="empty-products"><Search size={30}/><h3>No listings found</h3><p>Try another search or category.</p><button className="outline-btn" onClick={() => { setSearch(''); setCategory('All products'); }}>Clear filters</button></div> : <div className="product-grid">{filtered.map(p => <article key={p.id} className="product-card"><button className="product-image" style={{ background: p.color || '#efeee9' }} onClick={() => setDetail(p)} aria-label={`View ${p.name}`}><img src={p.image || '/demo/placeholder.svg'} alt={p.name} loading="lazy"/>{p.featured && <span className="product-tag">FEATURED LOT</span>}{p.stock <= 0 && <span className="sold-tag">SOLD OUT</span>}<span className="image-hover">Quick view <ArrowUpRight size={14}/></span></button><div className="product-meta"><span>{p.category}</span><button className="product-name" onClick={() => setDetail(p)}>{p.name}</button><div className="card-bottom"><strong>{money(p.priceCents)}</strong><button className="add-small" aria-label={`Add ${p.name} to bag`} disabled={!p.stock} onClick={() => addToCart(p)}><Plus size={18}/></button></div></div></article>)}</div>}
        </div></div></section>
        <section className="bottom-cta page-container"><div><span className="eyebrow">WHOLESALE & LIQUIDATION</span><h2>The better buy starts here.</h2><p>Browse inventory and build an order that works for your business.</p></div><a className="light-btn" href="#collection">Back to collection <ArrowUpRight size={18}/></a><span className="bottom-decoration">M&M</span></section>
      </main><footer className="footer page-container"><div><span className="footer-logo">M&amp;M</span><p>Bulk deals. Competitive prices. Reliable supply.</p></div><div><span>© {new Date().getFullYear()} {s.name}</span><button onClick={() => navigate('admin')}>Seller login <ArrowUpRight size={13}/></button></div></footer>
    </> : <>
      {!admin ? <AdminLogin onLogin={login} onShop={() => navigate('shop')}/> : <div className="admin-shell"><aside className="admin-sidebar"><button className="admin-brand" onClick={() => setAdminTab('overview')}><span className="admin-logo">M&amp;M</span><span>{s.name}<small>Seller workspace</small></span></button><div className="admin-side-label">WORKSPACE</div><nav className="admin-menu">{[['overview', LayoutDashboard, 'Overview'], ['products', Package, 'Products'], ['orders', ShoppingBag, 'Orders'], ['settings', Settings, 'Store settings'], ['payments', CreditCard, 'Payments']].map(([id, Icon, label]) => <button key={id} onClick={() => setAdminTab(id)} className={adminTab === id ? 'selected' : ''}><Icon size={19}/>{label}{id === 'products' && <span className="admin-counter">{adminData?.products?.length || 0}</span>}</button>)}</nav><div className="admin-sidebar-bottom"><button onClick={() => navigate('shop')}><ArrowUpRight size={18}/>View storefront</button><button onClick={logout}><LogOut size={18}/>Sign out</button></div></aside>
      <main className="admin-main"><header className="admin-top"><div className="breadcrumb">WORKSPACE <span>/</span> {adminTab.toUpperCase()}</div><div className="admin-top-right"><span className="live-dot"/> Your catalog <span className="avatar">S</span></div></header><div className="admin-content">
      {!adminData ? <div className="admin-loading">Loading your workspace...</div> : <>
      {adminTab === 'overview' && <><div className="dashboard-heading"><div><div className="eyebrow">YOUR STORE AT A GLANCE</div><h1>Welcome back<span className="olive-dot">.</span></h1><p>Here's what's happening with your storefront.</p></div><button className="dark-btn" onClick={() => { setAdminTab('products'); setEditor({...blankProduct}); }}><Plus size={17}/> Add product</button></div><div className="stat-grid"><Stat icon={Package} label="Total products" value={adminData.products.length} sub="In your catalog"/><Stat icon={Eye} label="Live products" value={adminData.products.filter(p => p.active).length} sub="Visible to visitors"/><Stat icon={ShoppingBag} label="Orders" value={adminData.orders.filter(o => o.status === 'paid').length} sub="Successfully paid"/><Stat icon={CreditCard} label="Sales" value={money(adminData.orders.filter(o => o.status === 'paid').reduce((n,o) => n + (o.amountPaidCents || o.totalCents), 0))} sub="Paid orders only"/></div><div className="overview-columns"><section className="dash-panel"><div className="panel-title"><h3>Recently added</h3><button onClick={() => setAdminTab('products')}>View all <ArrowRight size={16}/></button></div>{adminData.products.slice(0, 4).map(p => <div className="recent-product" key={p.id}><img src={p.image || '/demo/placeholder.svg'}/><div><strong>{p.name}</strong><small>{p.category}</small></div><span>{money(p.priceCents)}</span></div>)}{!adminData.products.length && <p className="muted">No products yet. Add your first one.</p>}</section><section className="dash-panel setup-panel"><div className="panel-title"><h3>Getting started</h3></div><div className="setup-item done"><span><Check size={17}/></span><div><strong>Your storefront is ready</strong><small>Catalog, cart and dashboard are set up</small></div></div><div className={`setup-item ${adminData.products.some(p => !p.isDemo) ? 'done' : ''}`}><span>{adminData.products.some(p => !p.isDemo) ? <Check size={17}/> : '2'}</span><div><strong>Add your first real product</strong><small>Replace the samples with your own listings</small></div></div><div className={`setup-item ${adminData.stripe.ready ? 'done' : ''}`}><span>{adminData.stripe.ready ? <Check size={17}/> : '3'}</span><div><strong>Connect payments</strong><small>Activate Stripe when you're ready</small></div></div><button className="outline-btn setup-action" onClick={() => setAdminTab('payments')}>Payment setup <ArrowUpRight size={15}/></button></section></div></>}
      {adminTab === 'products' && <><div className="dashboard-heading"><div><div className="eyebrow">YOUR INVENTORY</div><h1>Products<span className="olive-dot">.</span></h1><p>Create, update, and organize everything in your shop.</p></div><button className="dark-btn" onClick={() => setEditor({ ...blankProduct })}><Plus size={18}/> Add product</button></div>{adminData.products.some(p => p.isDemo) && <div className="sample-alert"><div><Sparkles size={20}/><span><strong>Sample products are included.</strong> Edit a sample to make it yours, or remove them and start fresh. Samples cannot be purchased.</span></div><button onClick={clearDemos}>Remove samples <Trash2 size={15}/></button></div>}{!adminData.products.length ? <div className="admin-empty"><Package size={30}/><h3>No products yet</h3><p>Create your first listing to make your catalog come to life.</p><button className="dark-btn" onClick={() => setEditor({ ...blankProduct })}>Add a product</button></div> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>STATUS</th><th>INVENTORY</th><th>PRICE</th><th></th></tr></thead><tbody>{adminData.products.map(p => <tr key={p.id}><td><div className="table-product"><img src={p.image || '/demo/placeholder.svg'}/><div><strong>{p.name}</strong><span>{p.category}{p.isDemo ? ' · Sample' : ''}</span></div></div></td><td><span className={`status ${p.active ? 'live' : 'draft'}`}>{p.active ? 'Live' : 'Hidden'}</span></td><td>{p.stock} in stock</td><td className="price-td">{money(p.priceCents)}</td><td><div className="table-actions"><button title="Edit" onClick={() => editProduct(p)}><Edit3 size={17}/></button><button title="Delete" className="red" onClick={() => deleteProduct(p)}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table></div>}</>}
      {adminTab === 'orders' && <><div className="dashboard-heading"><div><div className="eyebrow">YOUR BUSINESS</div><h1>Orders<span className="olive-dot">.</span></h1><p>Stripe-confirmed payments show up here.</p></div></div>{!adminData.orders.length ? <div className="admin-empty"><ShoppingBag size={30}/><h3>Your orders will appear here</h3><p>Once Stripe is connected and a customer completes a purchase, you can follow it here.</p></div> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>DATE</th><th>STATUS</th><th>TOTAL</th></tr></thead><tbody>{adminData.orders.map(o => <tr key={o.id}><td><strong>#{o.id.slice(0,8).toUpperCase()}</strong><span className="order-item-count">{o.items.length} products</span></td><td>{o.customerEmail || '—'}</td><td>{new Date(o.createdAt).toLocaleDateString()}</td><td><span className={`status ${o.status === 'paid' ? 'live' : 'draft'}`}>{o.status}</span></td><td className="price-td">{money(o.amountPaidCents || o.totalCents)}</td></tr>)}</tbody></table></div>}</>}
      {adminTab === 'settings' && <StoreSettings current={adminData.settings} onSave={async values => { await request('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(values) }); await refreshAdmin(); notify('Store settings saved.'); }} />}
      {adminTab === 'payments' && <Payments stripe={adminData.stripe}/>}
      </>}</div></main></div>}
    </>}
    {notice && <div className="toast"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
    {view === 'shop' && cartOpen && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setCartOpen(false); }}><div className="drawer" role="dialog" aria-label="Shopping bag" aria-modal="true"><div className="drawer-header"><div><small>YOUR SELECTION</small><h2>Shopping bag <span>({cartCount})</span></h2></div><button className="circle-close" onClick={() => setCartOpen(false)} aria-label="Close bag"><X size={21}/></button></div>{cartItems.length === 0 ? <div className="empty-bag"><ShoppingBag size={44}/><h3>Your bag is empty.</h3><p>Good things are waiting to be discovered.</p><button className="dark-btn" onClick={() => setCartOpen(false)}>Continue shopping <ArrowRight size={17}/></button></div> : <><div className="bag-items">{cartItems.map(({product:p, quantity}) => <div className="bag-item" key={p.id}><img src={p.image || '/demo/placeholder.svg'}/><div className="bag-item-info"><small>{p.category}</small><strong>{p.name}</strong><span>{money(p.priceCents)}</span><div className="quantity-control"><button onClick={() => changeQuantity(p, -1)} aria-label={`Remove one ${p.name}`}><Minus size={15}/></button><span>{quantity}</span><button onClick={() => changeQuantity(p, 1)} disabled={quantity >= p.stock} aria-label={`Add one ${p.name}`}><Plus size={15}/></button></div></div><button className="bag-remove" onClick={() => setCart(old => { const next = {...old}; delete next[p.id]; return next; })} title="Remove"><X size={16}/></button></div>)}</div><div className="drawer-bottom"><div className="subtotal"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div><p>Shipping and taxes, if applicable, are calculated at checkout.</p><button className="checkout-btn" onClick={checkout} disabled={!config?.stripeEnabled || saveBusy}>{config?.stripeEnabled ? (saveBusy ? 'Opening secure checkout…' : 'Continue to secure checkout') : 'Checkout · Coming soon'}<ArrowRight size={19}/></button>{!config?.stripeEnabled && <div className="stripe-disclaimer"><LockKeyhole size={14}/> The seller hasn't connected Stripe yet. No payments can be made.</div>}</div></>}</div></div>}
    {detail && view === 'shop' && <div className="overlay center-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null); }}><div className="detail-modal" role="dialog" aria-label={detail.name} aria-modal="true"><button className="circle-close detail-close" onClick={() => setDetail(null)} aria-label="Close product details"><X size={20}/></button><div className="detail-image" style={{background: detail.color || '#edece7'}}><img src={detail.image || '/demo/placeholder.svg'} alt={detail.name}/></div><div className="detail-text"><div className="eyebrow">{detail.category?.toUpperCase()}</div><h2>{detail.name}</h2><strong className="detail-price">{money(detail.priceCents)}</strong><p>{detail.description || 'Beautifully considered and ready for your everyday.'}</p><div className="detail-stock"><span className={`stock-dot ${detail.stock === 0 ? 'none' : ''}`}/>{detail.stock ? `${detail.stock} available` : 'Sold out'}</div><button className="dark-btn detail-add" onClick={() => addToCart(detail)} disabled={!detail.stock}><ShoppingBag size={18}/>{detail.stock ? 'Add to bag' : 'Out of stock'}<ArrowRight size={17}/></button><div className="detail-fine"><ShieldCheck size={16}/> Secure checkout available once the seller connects Stripe.</div></div></div></div>}
    {editor && admin && view === 'admin' && <ProductEditor item={editor} saving={saveBusy} onClose={() => setEditor(null)} onSave={saveProduct} onNotice={notify}/>} 
  </>;
}

function Stat({ icon: Icon, label, value, sub }) { return <section className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={20}/></div><strong>{value}</strong><small>{sub}</small></section>; }
function AdminLogin({ onLogin, onShop }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); setBusy(true); setErr(''); try { await onLogin(password); } catch (error) { setErr(error.message); } finally { setBusy(false); } };
  return <div className="login-page"><div className="login-left"><button className="back-store" onClick={onShop}><ArrowLeft size={16}/> Back to storefront</button><div className="login-art"><span>M&amp;M</span><strong>Good things<br/>start here.</strong><small>MANAGE YOUR STORE WITH EASE.</small></div></div><div className="login-right"><div className="login-box"><div className="login-icon"><LockKeyhole size={24}/></div><div className="eyebrow">SELLER WORKSPACE</div><h1>Welcome back.</h1><p>Enter your admin password to access your store dashboard.</p><form onSubmit={submit}><label htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" required minLength={1} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"/>{err && <div className="form-error">{err}</div>}<button className="dark-btn login-submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}<ArrowRight size={17}/></button></form><div className="login-help"><ShieldCheck size={17}/> Protected seller-only access.</div></div></div></div>;
}
function ProductEditor({ item, saving, onClose, onSave, onNotice }) {
  const [form, setForm] = useState(item);
  const [uploading, setUploading] = useState(false);
  const update = (key, value) => setForm(old => ({...old, [key]:value}));
  const upload = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    const data = new FormData(); data.append('image', file);
    setUploading(true);
    try { const response = await request('/api/admin/upload', { method: 'POST', body: data }); update('image', response.url); onNotice('Image uploaded.'); }
    catch (error) { onNotice(error.message); }
    finally { setUploading(false); }
  };
  const submit = e => { e.preventDefault(); onSave(form); };
  return <div className="overlay center-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}><div className="editor-modal" role="dialog" aria-label="Product editor" aria-modal="true"><div className="editor-head"><div><div className="eyebrow">INVENTORY / PRODUCT</div><h2>{item.id ? 'Edit product' : 'Add a product'}</h2></div><button className="circle-close" onClick={onClose} aria-label="Close"><X size={19}/></button></div><form onSubmit={submit} className="editor-body"><div className="editor-grid"><div className="editor-fields"><div className="field"><label>Product name <b>*</b></label><input required maxLength={110} value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Wholesale Case of General Merchandise"/></div><div className="field-row"><div className="field"><label>Price (USD) <b>*</b></label><div className="money-input"><span>$</span><input type="number" min="0.50" max="999999.99" step="0.01" required value={form.price} onChange={e => update('price', e.target.value)} placeholder="39.00"/></div></div><div className="field"><label>Quantity in stock</label><input type="number" min="0" max="1000000" step="1" required value={form.stock} onChange={e => update('stock', e.target.value)}/></div></div><div className="field"><label>Category</label><input value={form.category} maxLength={55} list="categories" onChange={e => update('category', e.target.value)} placeholder="General merchandise"/><datalist id="categories">{categoriesSeed.slice(1).map(x => <option key={x} value={x}/>)}</datalist></div><div className="field"><label>Description</label><textarea rows={4} maxLength={1400} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe contents, condition, minimum order, case count or pallet size."/></div><div className="field"><label>Image URL (optional)</label><input value={form.image} onChange={e => update('image', e.target.value)} placeholder="https://… or upload an image"/></div></div><div className="editor-image-side"><label>Product image</label><div className="image-preview" style={{background:form.color}}>{form.image ? <img src={form.image} alt="Product preview"/> : <ImagePlus size={40}/>}</div><label className="upload-btn"><UploadCloud size={17}/>{uploading ? 'Uploading image…' : 'Upload product photo'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={upload} disabled={uploading}/></label><small>JPG, PNG, WEBP or GIF · Up to 4 MB</small><div className="field"><label>Image background</label><div className="color-input"><input type="color" value={form.color} onChange={e => update('color', e.target.value)}/><span>{form.color}</span></div></div></div></div><div className="editor-options"><label className="toggle-line"><input type="checkbox" checked={form.active} onChange={e => update('active',e.target.checked)}/><span><strong>Visible on storefront</strong><small>Customers can discover this product</small></span></label><label className="toggle-line"><input type="checkbox" checked={form.featured} onChange={e => update('featured',e.target.checked)}/><span><strong>Feature this product</strong><small>Give it priority in the collection</small></span></label></div><div className="editor-footer"><button type="button" className="outline-btn" onClick={onClose}>Cancel</button><button className="dark-btn" type="submit" disabled={saving || uploading}>{saving ? 'Saving…' : item.id ? 'Save changes' : 'Add to catalog'}<ArrowRight size={17}/></button></div></form></div></div>;
}
function StoreSettings({ current, onSave }) {
  const [form, setForm] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (k, v) => setForm(o => ({...o, [k]:v}));
  const save = async e => { e.preventDefault(); setBusy(true); setError(''); try { await onSave(form); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <><div className="dashboard-heading"><div><div className="eyebrow">MAKE IT YOURS</div><h1>Store settings<span className="olive-dot">.</span></h1><p>Customize the name and words that your customers see.</p></div></div><form className="settings-panel" onSubmit={save}><h3>Store identity</h3><p>Changes appear on your public storefront right away.</p><div className="settings-two"><div className="field"><label>Store name</label><input maxLength={70} value={form.name} onChange={e => update('name',e.target.value)}/></div><div className="field"><label>Support email</label><input maxLength={160} type="email" value={form.supportEmail} onChange={e => update('supportEmail',e.target.value)}/></div></div><div className="field"><label>Small headline label</label><input value={form.eyebrow} maxLength={70} onChange={e => update('eyebrow',e.target.value)}/></div><div className="field"><label>Main homepage headline</label><input value={form.headline} maxLength={130} onChange={e => update('headline',e.target.value)}/></div><div className="field"><label>Homepage description</label><textarea rows={3} value={form.tagline} maxLength={300} onChange={e => update('tagline',e.target.value)}/></div><div className="field"><label>Top announcement</label><input value={form.announcement} maxLength={140} onChange={e => update('announcement',e.target.value)}/></div>{error && <div className="form-error">{error}</div>}<div className="settings-footer"><button className="dark-btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}<Check size={17}/></button></div></form></>;
}
function Payments({ stripe }) {
  const rows = [['Enable Stripe', stripe.enabledFlag], ['Secret API key', stripe.hasSecretKey], ['Webhook signing secret', stripe.hasWebhookSecret], ['Public base URL', stripe.hasBaseUrl]];
  return <><div className="dashboard-heading"><div><div className="eyebrow">PAYMENTS / INTEGRATIONS</div><h1>Payments<span className="olive-dot">.</span></h1><p>Everything is ready for Stripe, whenever you are.</p></div></div><div className="payments-layout"><div className="payment-main"><div className="stripe-head"><div className="stripe-mark">S</div><div><h2>Stripe Checkout</h2><p>Secure, hosted payment processing</p></div><span className={`connection-status ${stripe.ready ? 'connected' : ''}`}><span/> {stripe.ready ? 'Configured' : 'Not connected'}</span></div><div className="stripe-description"><strong>{stripe.ready ? 'Your Stripe extension is active.' : 'Connect your Stripe account when you’re ready.'}</strong><p>{stripe.ready ? 'Customers can proceed to Stripe Checkout for real products. Confirm your webhook is receiving events before launching.' : 'Your catalog and shopping bag already work. Payment collection stays disabled until the server has the Stripe keys and you enable the integration.'}</p></div><div className="config-checklist">{rows.map(([label, yes]) => <div key={label}><span className={`check-box ${yes ? 'checked' : ''}`}>{yes ? <Check size={14}/> : <span/>}</span><span>{label}</span><strong>{yes ? 'Configured' : 'Pending'}</strong></div>)}</div><div className="payment-foot"><LockKeyhole size={17}/><span>API keys belong on the server, never in the browser or public code.</span></div></div><aside className="payment-help"><div className="help-icon"><CreditCard size={22}/></div><h3>How to connect later</h3><ol><li>Create or open your Stripe account.</li><li>Add the Stripe secret key to your server’s <code>.env</code> file.</li><li>Register <code>/api/payments/stripe/webhook</code> in Stripe and add its signing secret.</li><li>Set your public site URL and switch <code>STRIPE_ENABLED=true</code>.</li><li>Test a payment and webhook before taking live orders.</li></ol><a href="https://docs.stripe.com/checkout/quickstart" target="_blank" rel="noreferrer">Stripe setup guide <ArrowUpRight size={15}/></a></aside></div><div className="payment-warning"><ShieldCheck size={20}/><div><strong>Built-in protection</strong><p>Product prices are checked on the server, Stripe verifies payments, and orders are marked paid only after a verified webhook event.</p></div></div></>;
}
createRoot(document.getElementById('root')).render(<App/>);