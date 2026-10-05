import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AI_URL = import.meta.env.VITE_AI_URL || "http://127.0.0.1:8001";
const PRODUCT_CLASSES = {
  drill: "DRL001",
  hammer: "HAM001",
  pliers: "PLR001",
  screwdriver: "SCR001",
  wrench: "WRC001",
};
const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((key) => key + 1);
  useEffect(() => {
    const navigate = (event) => setActivePage(event.detail);
    window.addEventListener("wms-navigate", navigate);
    return () => window.removeEventListener("wms-navigate", navigate);
  }, []);

  const pageTitles = {
    dashboard: ["Dashboard", "Operational overview and warehouse activity"],
    receive: ["Receive stock", "Use AI vision to count incoming tools"],
    dispatch: ["Dispatch stock", "Build an order, verify inventory, and create an invoice"],
    inventory: ["Inventory", "Current stock levels and storage locations"],
    history: ["Stock history", "Auditable receive and dispatch movements"],
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">SW</div>
          <div><strong>Warehouse OS</strong><span>Industrial operations</span></div>
        </div>
        <nav>
          {[
            ["dashboard", "Dashboard", "▦"],
            ["receive", "Receive", "↓"],
            ["dispatch", "Dispatch", "↑"],
            ["inventory", "Inventory", "▤"],
            ["history", "Stock history", "◷"],
          ].map(([page, label, icon]) => (
            <button className={activePage === page ? "active" : ""} key={page} onClick={() => setActivePage(page)}>
              <span className="nav-icon">{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Systems online</div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">WAREHOUSE CONTROL CENTER</p><h1>{pageTitles[activePage][0]}</h1><p>{pageTitles[activePage][1]}</p></div>
          <div className="header-tools">
            <div className="ai-status"><span className="status-dot" /> AI system online</div>
            <div className="date-chip">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
        </header>
        {activePage === "dashboard" && <Dashboard refreshKey={refreshKey} />}
        {activePage === "receive" && <Receive onChanged={refresh} />}
        {activePage === "dispatch" && <Dispatch onChanged={refresh} />}
        {activePage === "inventory" && <Inventory refreshKey={refreshKey} />}
        {activePage === "history" && <History refreshKey={refreshKey} />}
      </main>
    </div>
  );
}

function DataState({ error, loading, children }) {
  if (loading) return <div className="panel state">Loading warehouse data…</div>;
  if (error) return <div className="panel state error-state">{error}</div>;
  return children;
}

function Dashboard({ refreshKey }) {
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api("/products/dashboard"), api("/products")])
      .then(([dashboard, inventory]) => { setData(dashboard); setProducts(inventory); })
      .catch((err) => setError(err.message));
  }, [refreshKey]);
  if (error) return <div className="panel state error-state">{error}</div>;
  if (!data) return <div className="panel state">Loading warehouse data…</div>;
  return (
    <DataState>
      <div className="metric-grid">
        <Metric label="Total products" value={data.totalProducts} hint="SKUs in catalogue" icon="▤" />
        <Metric label="Units in stock" value={data.totalStock} hint="Across all locations" icon="▦" />
        <Metric label="Low stock alerts" value={data.lowStockProducts} hint="Needs replenishment" icon="!" tone="warning" />
        <Metric label="Today's dispatch" value={data.todayDispatchCount} hint="Completed movements" icon="↑" />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <SectionHeader title="Recent activity" action="Live movement ledger" />
          <MovementList movements={data.recentMovements} />
        </section>
        <section className="panel">
          <SectionHeader title="Low stock items" action="Needs attention" />
          {products.filter((product) => product.stock <= product.minimumStock).length ? (
            <div className="low-stock-list">{products.filter((product) => product.stock <= product.minimumStock).map((product) => <div className="low-stock-row" key={product._id}><ProductIcon name={product.name} /><div><strong>{product.name}</strong><small>{product.location}</small></div><span>{product.stock} / {product.minimumStock}</span></div>)}</div>
          ) : <div className="empty compact-empty"><span className="empty-icon">✓</span><strong>All stock levels healthy</strong><small>No replenishment action required.</small></div>}
        </section>
      </div>
      <section className="panel inventory-overview">
        <SectionHeader title="Inventory overview" action="View all inventory →" />
        <ProductTable products={products} compact />
      </section>
    </DataState>
  );
}

function Metric({ label, value, hint, icon, tone = "" }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    let frame;
    const animate = (now) => {
      const progress = Math.min((now - start) / 450, 1);
      setDisplayValue(Math.round(target * (1 - ((1 - progress) ** 3))));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <div className={`metric ${tone}`}><span className="metric-icon">{icon}</span><div><span>{label}</span><strong>{displayValue}</strong><small>{hint}</small></div></div>;
}

function SectionHeader({ title, action }) {
  return <div className="section-header"><h2>{title}</h2><span>{action}</span></div>;
}

function MovementList({ movements = [] }) {
  if (!movements.length) return <div className="empty">No stock movements recorded yet.</div>;
  return <div className="movement-list">{movements.map((movement) => <div className="movement" key={movement._id}><span className={`movement-icon ${movement.type.toLowerCase()}`}>{movement.type === "RECEIVE" ? "↓" : "↑"}</span><div><strong>{movement.product?.name || "Deleted product"}</strong><small>{movement.type} · {new Date(movement.createdAt).toLocaleString()}</small></div><b className={movement.type === "RECEIVE" ? "positive" : "negative"}>{movement.type === "RECEIVE" ? "+" : "-"}{movement.quantity}</b></div>)}</div>;
}

function ProductIcon({ name }) {
  const icons = { Drill: "╱", Hammer: "⌁", Pliers: "⌘", Screwdriver: "⌕", Wrench: "∿" };
  return <span className="product-icon" aria-hidden="true">{icons[name] || "•"}</span>;
}

function StatusBadge({ product }) {
  const status = product.stock === 0 ? "OUT OF STOCK" : product.stock <= product.minimumStock ? "LOW STOCK" : "IN STOCK";
  return <span className={`badge ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function CameraScanner({ onDetections, active, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const busyRef = useRef(false);
  const [status, setStatus] = useState("Camera is off");
  const [detections, setDetections] = useState([]);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    requestRef.current?.abort();
    requestRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    busyRef.current = false;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setDetections([]);
    setStatus("Camera is off");
  }, []);

  const scan = useCallback(async () => {
    if (!videoRef.current || busyRef.current || videoRef.current.readyState < 2) return;
    busyRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
      if (!blob || controller.signal.aborted) return;
      const form = new FormData(); form.append("file", blob, "warehouse-frame.jpg");
      const response = await fetch(`${AI_URL}/predict`, { method: "POST", body: form, signal: controller.signal });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "AI service unavailable");
      const next = (result.detections || []).filter((item) => item.confidence >= 0.6);
      setDetections(next); onDetections(next); setStatus(next.length ? `${next.length} object${next.length > 1 ? "s" : ""} detected` : "Scanning — no object detected");
    } catch (error) {
      if (error.name !== "AbortError") {
        setStatus(error.message);
        onError?.(error.message);
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      busyRef.current = false;
    }
  }, [onDetections, onError]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!stream) throw new Error("Camera is not available.");
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("AI camera ready");
        timerRef.current = setInterval(scan, 1200);
      } catch (error) {
        if (!cancelled) onError?.(error.message || "Camera permission was denied or no camera is available.");
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [active, onError, scan, stopCamera]);

  useEffect(() => {
    const handlePageHide = () => stopCamera();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [stopCamera]);

  return <div className="camera-wrap"><div className="camera-frame"><video ref={videoRef} autoPlay playsInline muted />{detections.map((d, index) => <span className="detection-tag" key={`${d.product}-${index}`} style={{ left: `${(d.box?.x1 || 0) / 6}%`, top: `${(d.box?.y1 || 0) / 5}%` }}>{d.product} {(d.confidence * 100).toFixed(0)}%</span>)}</div><div className="camera-status"><span className="status-dot" />{status}</div></div>;
}

function Receive({ onChanged }) {
  const [active, setActive] = useState(false);
  const [products, setProducts] = useState([]);
  const locks = useRef([]);
  const [lastResult, setLastResult] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => { api("/products").then(setProducts).catch((err) => setMessage(err.message)); }, [lastResult]);

  const handleDetections = useCallback(async (detections) => {
    const nextLocks = [];
    for (const detection of detections) {
      const center = { x: ((detection.box?.x1 || 0) + (detection.box?.x2 || 0)) / 2, y: ((detection.box?.y1 || 0) + (detection.box?.y2 || 0)) / 2 };
      const existing = locks.current.find((lock) => lock.product === detection.product && Math.hypot(lock.x - center.x, lock.y - center.y) < 100);
      if (existing) { nextLocks.push({ ...existing, x: center.x, y: center.y }); continue; }
      nextLocks.push({ product: detection.product, x: center.x, y: center.y });
      const product = products.find((item) => item.sku === PRODUCT_CLASSES[detection.product]);
      if (!product) continue;
      try {
        const result = await api(`/products/${product._id}/receive`, { method: "PATCH", body: JSON.stringify({ quantity: 1 }) });
        setLastResult({ name: product.name, confidence: detection.confidence, stock: result.product.stock });
        onChanged();
      } catch (error) { setMessage(error.message); }
    }
    locks.current = nextLocks;
  }, [onChanged, products]);

  return <div className="scanner-layout"><section className="panel scanner-panel"><SectionHeader title="AI receiving station" action="Confidence threshold 60%" />{!active ? <div className="camera-placeholder"><div className="camera-symbol">◉</div><h2>AI Camera Scanner</h2><p>Point the camera at a warehouse product. Stable detections are counted once until the product leaves the frame.</p><button className="button primary" onClick={() => { setMessage(""); setActive(true); }}>Start camera</button></div> : <><CameraScanner active={active} onDetections={handleDetections} onError={setMessage} /><button className="button secondary" onClick={() => setActive(false)}>Stop camera</button></>}</section><section className="panel result-panel"><p className="eyebrow">LATEST RECEIVE</p>{lastResult ? <><div className="detection-card"><ProductIcon name={lastResult.name} /><div><span>Detected product</span><h2>{lastResult.name}</h2><small>SKU {PRODUCT_CLASSES[lastResult.name.toLowerCase()] || "—"}</small></div><span className="result-check">✓</span></div><div className="confidence-row"><span>Confidence</span><strong>{(lastResult.confidence * 100).toFixed(1)}%</strong></div><div className="stock-result"><span>+1 stock added · Updated stock</span><strong>{lastResult.stock} units</strong></div></> : <div className="empty"><span className="empty-icon">◉</span><strong>No AI detection yet</strong><small>Start the camera to begin receiving.</small></div>}{message && <div className="inline-error">{message}</div>}</section></div>;
}

function Dispatch({ onChanged }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [active, setActive] = useState(false);
  const [client, setClient] = useState({ name: "", phone: "", address: "", gstin: "" });
  const [message, setMessage] = useState("");
  const [invoice, setInvoice] = useState(null);
  const locks = useRef([]);
  const invoiceSequence = useRef(0);
  useEffect(() => { api("/products").then(setProducts).catch((err) => setMessage(err.message)); }, [invoice]);
  const addDetection = useCallback((detections) => {
    const nextLocks = [];
    detections.forEach((detection) => {
      const x = ((detection.box?.x1 || 0) + (detection.box?.x2 || 0)) / 2;
      const y = ((detection.box?.y1 || 0) + (detection.box?.y2 || 0)) / 2;
      const existing = locks.current.find((lock) => lock.product === detection.product && Math.hypot(lock.x - x, lock.y - y) < 100);
      nextLocks.push({ product: detection.product, x, y });
      if (existing) return;
      const product = products.find((item) => item.sku === PRODUCT_CLASSES[detection.product]);
      if (!product) return;
      setCart((current) => { const found = current.find((item) => item._id === product._id); return found ? current.map((item) => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; });
    });
    locks.current = nextLocks;
  }, [products]);
  const updateQuantity = (id, value) => setCart((current) => current.map((item) => item._id === id ? { ...item, quantity: Math.max(1, Number(value) || 1) } : item));
  const total = cart.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
  const confirmDispatch = async () => {
    if (!client.name.trim() || !client.phone.trim() || !client.address.trim()) return setMessage("Enter client name, phone, and address before confirming.");
    try {
      await api("/products/dispatch/transaction", { method: "POST", body: JSON.stringify({ client, items: cart.map((item) => ({ productId: item._id, quantity: item.quantity })) }) });
      invoiceSequence.current += 1;
      setInvoice({ number: `INV-${String(invoiceSequence.current).padStart(6, "0")}`, date: new Date(), client, items: cart, total });
      setCart([]); setClient({ name: "", phone: "", address: "", gstin: "" }); onChanged(); setMessage("");
    } catch (error) { setMessage(error.message); }
  };
  return <div className="dispatch-layout"><section className="panel scanner-panel"><SectionHeader title="AI dispatch scanner" action="Review before commit" />{!active ? <div className="camera-placeholder compact"><div className="camera-symbol">◉</div><p>Scan tools into a temporary dispatch cart. Inventory changes only after confirmation.</p><button className="button primary" onClick={() => setActive(true)}>Start camera</button></div> : <><CameraScanner active={active} onDetections={addDetection} onError={setMessage} /><button className="button secondary" onClick={() => setActive(false)}>Stop camera</button></>}</section><section className="panel cart-panel"><SectionHeader title="Dispatch cart" action={`${cart.reduce((sum, item) => sum + item.quantity, 0)} units`} />{cart.length ? <div className="cart-items">{cart.map((item) => <div className="cart-item" key={item._id}><div><strong>{item.name}</strong><small>{item.sku} · {currency(item.sellingPrice)} each · stock {item.stock}</small></div><input type="number" min="1" value={item.quantity} onChange={(event) => updateQuantity(item._id, event.target.value)} /><button className="icon-button" onClick={() => setCart((current) => current.filter((entry) => entry._id !== item._id))}>×</button></div>)}</div> : <div className="empty">Your cart is empty. Use the camera or add a product manually below.</div>}<select className="field" value="" onChange={(event) => { const product = products.find((item) => item._id === event.target.value); if (product) setCart((current) => [...current, { ...product, quantity: 1 }]); }}><option value="">+ Add product manually</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name} · {product.stock} in stock</option>)}</select>{cart.length > 0 && <><div className="total-row"><span>Grand total</span><strong>{currency(total)}</strong></div><div className="client-form"><p className="eyebrow">CLIENT DETAILS</p><input className="field" placeholder="Client / company name *" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /><input className="field" placeholder="Phone number *" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} /><textarea className="field" placeholder="Delivery address *" value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} /><input className="field" placeholder="GSTIN (optional)" value={client.gstin} onChange={(e) => setClient({ ...client, gstin: e.target.value })} /><button className="button primary" onClick={confirmDispatch}>Confirm dispatch & generate invoice</button></div></>}</section>{message && <div className="toast error-state">{message}</div>}{invoice && <Invoice invoice={invoice} onClose={() => setInvoice(null)} />}</div>;
}

function Invoice({ invoice, onClose }) {
  return <div className="invoice-overlay"><div className="invoice print-invoice"><div className="invoice-actions"><button className="button secondary" onClick={onClose}>Close</button><button className="button primary" onClick={() => window.print()}>Print invoice</button></div><div className="invoice-head"><div><p className="eyebrow">SMARTWMS</p><h2>Dispatch invoice</h2></div><div><strong>{invoice.number}</strong><p>{invoice.date.toLocaleString()}</p></div></div><div className="invoice-client"><strong>{invoice.client.name}</strong><span>{invoice.client.phone}</span><span>{invoice.client.address}</span>{invoice.client.gstin && <span>GSTIN: {invoice.client.gstin}</span>}</div><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead><tbody>{invoice.items.map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{currency(item.sellingPrice)}</td><td>{currency(item.quantity * item.sellingPrice)}</td></tr>)}</tbody></table><div className="invoice-total">Grand total <strong>{currency(invoice.total)}</strong></div></div></div>;
}

function Inventory({ refreshKey }) {
  const [products, setProducts] = useState([]); const [query, setQuery] = useState(""); const [error, setError] = useState("");
  useEffect(() => { api("/products").then(setProducts).catch((err) => setError(err.message)); }, [refreshKey]);
  const filtered = products.filter((product) => `${product.name} ${product.sku} ${product.location}`.toLowerCase().includes(query.toLowerCase()));
  return <DataState loading={!products.length && !error} error={error}><section className="panel"><SectionHeader title="Inventory register" action={`${filtered.length} products`} /><input className="search field" placeholder="Search product, SKU, or location…" value={query} onChange={(event) => setQuery(event.target.value)} /><ProductTable products={filtered} /></section></DataState>;
}

function ProductTable({ products, compact = false }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Minimum</th><th>Location</th>{!compact && <th>Price</th>}<th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product._id}><td><div className="product-name"><ProductIcon name={product.name} /><strong>{product.name}</strong></div></td><td className="muted">{product.sku}</td><td><strong>{product.stock}</strong></td><td>{product.minimumStock}</td><td>{product.location}</td>{!compact && <td>{currency(product.sellingPrice)}</td>}<td><StatusBadge product={product} /></td></tr>)}</tbody></table></div>;
}

function History({ refreshKey }) {
  const [movements, setMovements] = useState([]); const [error, setError] = useState("");
  useEffect(() => { api("/products/movements/history").then(setMovements).catch((err) => setError(err.message)); }, [refreshKey]);
  return <DataState loading={!movements.length && !error} error={error}><section className="panel"><SectionHeader title="Movement ledger" action="Newest first" /><div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Type</th><th>Quantity</th><th>Date and time</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement._id}><td><strong>{movement.product?.name || "Deleted product"}</strong></td><td className="muted">{movement.product?.sku || "—"}</td><td><span className={`badge ${movement.type.toLowerCase()}`}>{movement.type}</span></td><td>{movement.quantity}</td><td>{new Date(movement.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div></section></DataState>;
}

export default App;
