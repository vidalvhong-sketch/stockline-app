import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  LayoutDashboard, Package, Truck, ArrowLeftRight, ScanBarcode, Plus, X,
  ArrowDownToLine, ArrowUpFromLine, Ban, RotateCcw, Search, AlertTriangle, CheckCircle2, LogOut,
  Users, KeyRound, Trash2, ShieldCheck,
} from "lucide-react";
import { api, getToken, getAgentName, getAgentRole, setSession, clearSession } from "./api.js";

/* ---------------------------------------------------------------
   THEME — "warehouse control panel"
--------------------------------------------------------------- */
const T = {
  bg: "#141A22",
  surface: "#1B2330",
  surfaceRaised: "#232C3B",
  surfaceInput: "#1A212C",
  border: "#2E3948",
  borderStrong: "#3D4B5E",
  amber: "#F2B705",
  amberDim: "#8A6A0C",
  in: "#3FC79A",
  inDim: "#1E5C46",
  out: "#E8604C",
  outDim: "#6E2B21",
  waste: "#A87C5A",
  wasteDim: "#4A3826",
  text: "#EDEFF2",
  textMuted: "#8B96A5",
  textFaint: "#5A6473",
};

const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" };
const fontMono = { fontFamily: "'IBM Plex Mono', monospace" };
const fontBody = { fontFamily: "'Inter', sans-serif" };

const COMMON_UNITS = ["pcs", "kg", "g", "sack", "pack", "box", "ream", "liter", "roll", "dozen", "set", "bottle"];

function statusTone(status) {
  if (status === "active") return "in";
  if (status === "hold") return "amber";
  return "out"; // stopped
}
function statusLabel(status) {
  if (status === "hold") return "on hold";
  return status;
}
function movementTone(type) {
  if (type === "IN") return "in";
  if (type === "OUT") return "out";
  return "waste"; // DISCARD
}

/* ---------------------------------------------------------------
   HELPERS
--------------------------------------------------------------- */
function fmtMoney(n) {
  const v = Number(n) || 0;
  return "\u20B1" + v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}
function periodKey(iso, granularity) {
  const d = new Date(iso);
  if (granularity === "daily") return d.toISOString().slice(0, 10);
  if (granularity === "weekly") return startOfWeek(d).toISOString().slice(0, 10);
  return String(d.getFullYear());
}
function periodLabel(key, granularity) {
  if (granularity === "yearly") return key;
  const d = new Date(key + "T00:00:00");
  if (granularity === "daily") return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}\u2013${end.toLocaleDateString("en-PH", { day: "numeric" })}`;
}
function periodsBack(granularity, count) {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    if (granularity === "daily") d.setDate(d.getDate() - i);
    if (granularity === "weekly") d.setDate(d.getDate() - i * 7);
    if (granularity === "yearly") d.setFullYear(d.getFullYear() - i);
    keys.push(periodKey(d.toISOString(), granularity));
  }
  return [...new Set(keys)];
}

/* ---------------------------------------------------------------
   BARCODE VISUAL
--------------------------------------------------------------- */
function BarcodeSVG({ value, height = 44, width = 180, color = T.text }) {
  const digits = (value || "000000000000").split("").map(Number);
  const bars = [];
  let x = 0;
  const unit = width / (digits.length * 3.2);
  digits.forEach((d, i) => {
    const w1 = ((d % 4) + 1) * unit * 0.5;
    const gap = unit * 0.4;
    const w2 = (((d + 3) % 4) + 1) * unit * 0.35;
    bars.push(<rect key={i + "a"} x={x} y={0} width={w1} height={height} fill={color} />);
    x += w1 + gap;
    bars.push(<rect key={i + "b"} x={x} y={0} width={w2} height={height} fill={color} />);
    x += w2 + gap * 0.6;
  });
  return (
    <svg viewBox={`0 0 ${x} ${height}`} width={width} height={height} preserveAspectRatio="none">
      {bars}
    </svg>
  );
}

/* ---------------------------------------------------------------
   UI PRIMITIVES
--------------------------------------------------------------- */
function Card({ children, style }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 20, ...style }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ ...fontMono, fontSize: 11, letterSpacing: "0.08em", color: T.textMuted, textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}
const Input = React.forwardRef((props, ref) => (
  <input
    ref={ref}
    {...props}
    style={{
      width: "100%", background: T.surfaceInput, border: `1px solid ${T.border}`, borderRadius: 4,
      padding: "9px 10px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box",
      ...fontBody, ...(props.style || {}),
    }}
  />
));
function Select(props) {
  return (
    <select {...props} style={{
      width: "100%", background: T.surfaceInput, border: `1px solid ${T.border}`, borderRadius: 4,
      padding: "9px 10px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box",
      ...fontBody, ...(props.style || {}),
    }}>
      {props.children}
    </select>
  );
}
function Button({ children, onClick, variant = "default", type = "button", style, disabled }) {
  const variants = {
    default: { background: T.surfaceRaised, border: `1px solid ${T.borderStrong}`, color: T.text },
    amber: { background: T.amber, border: `1px solid ${T.amber}`, color: "#241B02" },
    in: { background: T.in, border: `1px solid ${T.in}`, color: "#0A2A1F" },
    out: { background: T.out, border: `1px solid ${T.out}`, color: "#2E120C" },
    ghost: { background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted },
    waste: { background: T.waste, border: `1px solid ${T.waste}`, color: "#2A2016" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...variants[variant], borderRadius: 4, padding: "9px 16px", fontSize: 13, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      display: "inline-flex", alignItems: "center", gap: 6, ...fontBody, ...style,
    }}>
      {children}
    </button>
  );
}
function Badge({ children, tone = "default" }) {
  const tones = {
    default: { bg: T.surfaceRaised, fg: T.textMuted, bd: T.border },
    in: { bg: T.inDim, fg: "#B7F0DD", bd: T.in },
    out: { bg: T.outDim, fg: "#F6C4BA", bd: T.out },
    amber: { bg: T.amberDim, fg: "#FBE29B", bd: T.amber },
    waste: { bg: T.wasteDim, fg: "#E4D0BA", bd: T.waste },
  };
  const c = tones[tone];
  return (
    <span style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 3, padding: "2px 8px", fontSize: 11, ...fontMono, letterSpacing: "0.04em", textTransform: "uppercase", display: "inline-block" }}>
      {children}
    </span>
  );
}
function SectionHeader({ eyebrow, title, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={{ ...fontMono, fontSize: 11, color: T.amber, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>{eyebrow}</div>
        <h1 style={{ ...fontDisplay, fontSize: 24, fontWeight: 700, color: T.text, margin: 0 }}>{title}</h1>
      </div>
      {action}
    </div>
  );
}
function BarcodeDivider() {
  const bars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i++) arr.push(Math.random() > 0.5 ? 3 : 1);
    return arr;
  }, []);
  return (
    <div style={{ display: "flex", gap: 2, height: 14, margin: "24px 0", opacity: 0.5 }}>
      {bars.map((w, i) => <div key={i} style={{ width: w, background: i % 7 === 0 ? T.amber : T.borderStrong, height: "100%" }} />)}
    </div>
  );
}

/* ---------------------------------------------------------------
   LOGIN
--------------------------------------------------------------- */
function Login({ onLoggedIn }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(name, pin);
      setSession(res.token, res.name, res.role);
      onLoggedIn(res.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: T.bg, minHeight: 500, display: "flex", alignItems: "center", justifyContent: "center", ...fontBody }}>
      <form onSubmit={submit} style={{ width: 320, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <ScanBarcode size={20} color={T.amber} />
          <div style={{ ...fontDisplay, fontWeight: 700, fontSize: 19, color: T.text }}>STOCKLINE</div>
        </div>
        <div style={{ ...fontMono, fontSize: 11, color: T.textFaint, letterSpacing: "0.08em", marginBottom: 24 }}>AGENT SIGN-IN</div>

        <Label>Your name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mika" style={{ marginBottom: 14 }} autoFocus />

        <Label>PIN</Label>
        <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Your PIN" style={{ marginBottom: 18 }} />

        {error && <div style={{ color: T.out, fontSize: 12, marginBottom: 14 }}>{error}</div>}

        <Button type="submit" variant="amber" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Signing in\u2026" : "Sign in"}
        </Button>

        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 16, lineHeight: 1.5 }}>
          First time here? Sign in as <span style={{ color: T.textMuted }}>Admin</span> with the default PIN your
          admin set up, then add your team from the Agents tab.
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------
   MAIN APP
--------------------------------------------------------------- */
export default function App() {
  const [agentName, setAgentName] = useState(getToken() ? getAgentName() : null);
  const [role, setRole] = useState(getToken() ? getAgentRole() : null);
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState("");

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!agentName) return;
    (async () => {
      try {
        const state = await api.getState();
        setProducts(state.products);
        setSuppliers(state.suppliers);
        setTransactions(state.transactions);
        setRole(state.role);
        setReady(true);
      } catch (err) {
        setLoadError(err.message);
        if (!getToken()) setAgentName(null);
      }
    })();
  }, [agentName]);

  function showToast(msg, tone = "default") {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2600);
  }

  function logout() {
    clearSession();
    setAgentName(null);
    setRole(null);
    setReady(false);
  }

  async function addSupplier(sup) {
    try {
      const created = await api.addSupplier(sup);
      setSuppliers((s) => [...s, created]);
      showToast("Supplier added", "in");
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  async function addProduct(prod) {
    try {
      const created = await api.addProduct(prod);
      setProducts((p) => [...p, created]);
      showToast("Product added to inventory", "in");
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  async function setProductStatus(productId, status) {
    try {
      const updated = await api.setProductStatus(productId, status);
      setProducts((prev) => prev.map((p) => (p.id === productId ? updated : p)));
      const toneMap = { active: "in", hold: "amber", stopped: "out" };
      showToast(`${updated.name} set to ${statusLabel(status)}`, toneMap[status] === "amber" ? "default" : toneMap[status]);
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  async function deleteProduct(productId, productName) {
    try {
      await api.deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      showToast(`${productName} deleted`, "out");
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  async function logMovement(entry) {
    try {
      const res = await api.logTransaction(entry);
      setTransactions((t) => [res.transaction, ...t]);
      setProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
      showToast(entry.type === "IN" ? "Stock in logged" : "Stock out logged", entry.type === "IN" ? "in" : "out");
      return true;
    } catch (err) {
      showToast(err.message, "out");
      return false;
    }
  }

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products]);

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "products", label: "Products", icon: Package },
    { key: "suppliers", label: "Suppliers", icon: Truck },
    { key: "movement", label: "Movement log", icon: ArrowLeftRight },
    { key: "barcode", label: "Barcode control", icon: ScanBarcode },
    ...(isAdmin ? [{ key: "agents", label: "Agents", icon: Users }] : []),
  ];

  if (!agentName) {
    return <Login onLoggedIn={setAgentName} />;
  }

  if (!ready) {
    return (
      <div style={{ background: T.bg, minHeight: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: T.textMuted, ...fontMono, gap: 12 }}>
        {loadError ? <div style={{ color: T.out }}>{loadError}</div> : "loading inventory..."}
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", ...fontBody }}>
      <div style={{ width: 208, background: T.surface, borderRight: `1px solid ${T.border}`, padding: "20px 14px", flexShrink: 0 }}>
        <div style={{ padding: "0 8px 20px", borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
          <div style={{ ...fontDisplay, fontWeight: 700, fontSize: 17, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
            <ScanBarcode size={18} color={T.amber} />
            STOCKLINE
          </div>
          <div style={{ ...fontMono, fontSize: 10, color: T.textFaint, marginTop: 2, letterSpacing: "0.08em" }}>INVENTORY CONTROL</div>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const activeStyle = view === item.key
            ? { background: T.surfaceRaised, color: T.text, borderLeft: `2px solid ${T.amber}` }
            : { background: "transparent", color: T.textMuted, borderLeft: `2px solid transparent` };
          return (
            <div key={item.key} onClick={() => setView(item.key)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", marginBottom: 2,
              borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 500, ...activeStyle,
            }}>
              <Icon size={16} />
              {item.label}
            </div>
          );
        })}
        <div style={{ position: "absolute", bottom: 20, width: 180 }}>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, marginTop: 14 }}>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Signed in as <span style={{ color: T.text }}>{agentName}</span></div>
            <div style={{ marginBottom: 8 }}><Badge tone={isAdmin ? "amber" : "default"}>{role || "user"}</Badge></div>
            <Button variant="ghost" style={{ fontSize: 12, padding: "6px 10px", width: "100%", justifyContent: "center" }} onClick={logout}>
              <LogOut size={13} />Sign out
            </Button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 28, minWidth: 0, position: "relative" }}>
        {toast && (
          <div style={{
            position: "fixed", top: 20, right: 28, zIndex: 10,
            background: toast.tone === "in" ? T.inDim : toast.tone === "out" ? T.outDim : T.surfaceRaised,
            border: `1px solid ${toast.tone === "in" ? T.in : toast.tone === "out" ? T.out : T.border}`,
            color: T.text, padding: "10px 16px", borderRadius: 4, fontSize: 13, ...fontBody,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {toast.tone === "in" ? <CheckCircle2 size={15} color={T.in} /> : toast.tone === "out" ? <AlertTriangle size={15} color={T.out} /> : null}
            {toast.msg}
          </div>
        )}

        {view === "dashboard" && <Dashboard products={products} transactions={transactions} suppliers={suppliers} />}
        {view === "products" && <ProductsView products={products} categories={categories} onAdd={addProduct} onSetStatus={setProductStatus} onDelete={deleteProduct} isAdmin={isAdmin} />}
        {view === "suppliers" && <SuppliersView suppliers={suppliers} transactions={transactions} onAdd={addSupplier} isAdmin={isAdmin} />}
        {view === "movement" && <MovementView products={products} suppliers={suppliers} transactions={transactions} onLog={logMovement} defaultStaff={agentName} />}
        {view === "barcode" && <BarcodeView products={products} onSetStatus={setProductStatus} isAdmin={isAdmin} />}
        {view === "agents" && isAdmin && <AgentsView currentAgentName={agentName} showToast={showToast} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   DASHBOARD
--------------------------------------------------------------- */
function Dashboard({ products, transactions, suppliers }) {
  const [granularity, setGranularity] = useState("daily");
  const counts = { daily: 14, weekly: 10, yearly: 5 };

  const chartData = useMemo(() => {
    const keys = periodsBack(granularity, counts[granularity]);
    return keys.map((k) => {
      const inQty = transactions.filter((t) => t.type === "IN" && periodKey(t.timestamp, granularity) === k).reduce((s, t) => s + t.qty, 0);
      const outQty = transactions.filter((t) => t.type === "OUT" && periodKey(t.timestamp, granularity) === k).reduce((s, t) => s + t.qty, 0);
      const discardQty = transactions.filter((t) => t.type === "DISCARD" && periodKey(t.timestamp, granularity) === k).reduce((s, t) => s + t.qty, 0);
      return { key: k, label: periodLabel(k, granularity), "Stock in": inQty, "Stock out": outQty, "Discarded": discardQty };
    });
  }, [transactions, granularity]);

  const activeProducts = products.filter((p) => p.status === "active");
  const totalStockUnits = products.reduce((s, p) => s + p.stock, 0);
  const lowStock = activeProducts.filter((p) => p.stock > 0 && p.stock <= 10);
  const outOfStock = activeProducts.filter((p) => p.stock === 0);

  const findProduct = (t) => products.find((pp) => pp.id === (t.product_id || t.productId));

  const totalCostFromSuppliers = useMemo(
    () => transactions.filter((t) => t.type === "IN").reduce((s, t) => s + t.price * t.qty, 0),
    [transactions]
  );
  const totalRetailSales = useMemo(
    () => transactions.filter((t) => t.type === "OUT").reduce((s, t) => s + t.price * t.qty, 0),
    [transactions]
  );
  const totalMarketSales = useMemo(
    () => transactions.filter((t) => t.type === "OUT").reduce((s, t) => {
      const p = findProduct(t);
      return s + (p && p.market_price != null ? p.market_price * t.qty : 0);
    }, 0),
    [transactions, products]
  );
  const totalDiscarded = useMemo(
    () => transactions.filter((t) => t.type === "DISCARD").reduce((s, t) => s + t.price * t.qty, 0),
    [transactions]
  );

  const stats = [
    { label: "Total stock units", value: totalStockUnits.toLocaleString(), plain: true },
    { label: "Cost from suppliers", value: fmtMoney(totalCostFromSuppliers) },
    { label: "Retail sales", value: fmtMoney(totalRetailSales) },
    { label: "Market value (sales)", value: fmtMoney(totalMarketSales) },
    { label: "Lost / discarded", value: fmtMoney(totalDiscarded), warn: true },
  ];

  return (
    <div>
      <SectionHeader eyebrow="Overview" title="Inventory dashboard" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        {stats.map((s) => (
          <Card key={s.label} style={{ padding: 16 }}>
            <Label>{s.label}</Label>
            <div style={{ ...fontDisplay, fontSize: s.plain ? 26 : 22, fontWeight: 700, color: s.warn ? T.waste : T.text }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: T.text }}>Stock movement</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["daily", "weekly", "yearly"].map((g) => (
              <button key={g} onClick={() => setGranularity(g)} style={{
                ...fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                padding: "6px 12px", borderRadius: 3, cursor: "pointer",
                background: granularity === g ? T.amber : "transparent",
                color: granularity === g ? "#241B02" : T.textMuted,
                border: `1px solid ${granularity === g ? T.amber : T.border}`,
              }}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="label" stroke={T.textFaint} tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis stroke={T.textFaint} tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
              <Tooltip contentStyle={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12, color: T.text }} labelStyle={{ color: T.textMuted }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: T.textMuted }} />
              <Bar dataKey="Stock in" fill={T.in} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Stock out" fill={T.out} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Discarded" fill={T.waste} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <BarcodeDivider />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <Label>Low stock (\u226410 units)</Label>
          {lowStock.length === 0 && outOfStock.length === 0 ? (
            <div style={{ color: T.textFaint, fontSize: 13, marginTop: 8 }}>Nothing running low.</div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {outOfStock.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, color: T.text }}>{p.name}</span>
                  <Badge tone="out">Out of stock</Badge>
                </div>
              ))}
              {lowStock.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, color: T.text }}>{p.name}</span>
                  <span style={{ ...fontMono, fontSize: 12, color: T.amber }}>{p.stock} {p.unit || "pcs"} left</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <Label>Recent movement</Label>
          <div style={{ marginTop: 8 }}>
            {transactions.slice(0, 5).map((t) => {
              const p = findProduct(t);
              return (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}`, gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p ? p.name : "Unknown product"}</span>
                    <span style={{ fontSize: 11, color: T.textFaint }}>{t.staff}</span>
                  </div>
                  <Badge tone={movementTone(t.type)}>{t.type} {t.qty}</Badge>
                </div>
              );
            })}
            {transactions.length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>No movement logged yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PRODUCTS VIEW
--------------------------------------------------------------- */
function ProductsView({ products, categories, onAdd, onSetStatus, onDelete, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", purchasePrice: "", retailPrice: "", marketPrice: "", stock: "", barcode: "", unit: "pcs" });
  const [query, setQuery] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!form.name || !form.category || !form.purchasePrice || !form.retailPrice) return;
    onAdd(form);
    setForm({ name: "", category: "", purchasePrice: "", retailPrice: "", marketPrice: "", stock: "", barcode: "", unit: "pcs" });
    setShowForm(false);
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase()) ||
    p.barcode.includes(query)
  );

  return (
    <div>
      <SectionHeader eyebrow="Catalog" title="Products" action={
        isAdmin && <Button variant="amber" onClick={() => setShowForm((s) => !s)}>{showForm ? <X size={14} /> : <Plus size={14} />}{showForm ? "Cancel" : "Add product"}</Button>
      } />

      {isAdmin && showForm && (
        <Card style={{ marginBottom: 20 }}>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <Label>Product name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. A4 Bond Paper" />
              </div>
              <div>
                <Label>Category</Label>
                <Input required list="cat-list" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Office Supplies" />
                <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <Label>Unit</Label>
                <Input required list="unit-list" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" />
                <datalist id="unit-list">{COMMON_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <Label>Purchase price (from supplier)</Label>
                <Input required type="number" step="0.01" min="0" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>Retail price (you sell at)</Label>
                <Input required type="number" step="0.01" min="0" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>Outside market price (optional)</Label>
                <Input type="number" step="0.01" min="0" value={form.marketPrice} onChange={(e) => setForm({ ...form, marketPrice: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>Starting stock</Label>
                <Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div style={{ marginBottom: 14, maxWidth: 260 }}>
              <Label>Barcode (leave blank to auto-generate)</Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="auto" style={fontMono} />
            </div>
            <Button type="submit" variant="in"><Plus size={14} />Save product</Button>
          </form>
        </Card>
      )}

      <div style={{ marginBottom: 14, maxWidth: 320, position: "relative" }}>
        <Search size={14} color={T.textFaint} style={{ position: "absolute", left: 10, top: 11 }} />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, category, or barcode" style={{ paddingLeft: 30 }} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Barcode", "Product", "Category", "Unit", "Cost (supplier)", "Retail", "Market", "Stock", "Status", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 16px", ...fontMono, fontSize: 10, letterSpacing: "0.06em", color: T.textFaint, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const margin = p.retail_price - p.purchase_price;
              const marginPct = p.purchase_price > 0 ? (margin / p.purchase_price) * 100 : null;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 12, color: T.textMuted }}>{p.barcode}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.text }}>{p.name}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.textMuted }}>{p.category}</td>
                  <td style={{ padding: "10px 16px" }}><Badge>{p.unit || "pcs"}</Badge></td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: T.textMuted }}>{fmtMoney(p.purchase_price)}</td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: T.text }}>
                    {fmtMoney(p.retail_price)}
                    {marginPct !== null && (
                      <div style={{ fontSize: 10, color: margin >= 0 ? T.in : T.out, marginTop: 2 }}>{margin >= 0 ? "+" : ""}{marginPct.toFixed(0)}% margin</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: T.textFaint }}>{p.market_price != null ? fmtMoney(p.market_price) : "\u2014"}</td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: p.stock === 0 ? T.out : p.stock <= 10 ? T.amber : T.text }}>{p.stock} {p.unit || "pcs"}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {isAdmin ? (
                      <Select
                        value={p.status}
                        onChange={(e) => onSetStatus(p.id, e.target.value)}
                        style={{ padding: "4px 6px", fontSize: 11, width: 108, ...fontMono }}
                      >
                        <option value="active">active</option>
                        <option value="hold">on hold</option>
                        <option value="stopped">stopped</option>
                      </Select>
                    ) : (
                      <Badge tone={statusTone(p.status)}>{statusLabel(p.status)}</Badge>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        style={{ padding: "5px 10px", fontSize: 11, color: T.out }}
                        onClick={() => {
                          if (window.confirm(`Delete "${p.name}"? This can't be undone. Past movement history will show it as a deleted product instead of being removed.`)) {
                            onDelete(p.id, p.name);
                          }
                        }}
                      >
                        <Trash2 size={12} />Delete
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: T.textFaint, fontSize: 13 }}>No products match.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   SUPPLIERS VIEW
--------------------------------------------------------------- */
function SuppliersView({ suppliers, transactions, onAdd, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", phone: "" });

  function submit(e) {
    e.preventDefault();
    if (!form.name) return;
    onAdd(form);
    setForm({ name: "", contact: "", phone: "" });
    setShowForm(false);
  }

  const deliveryCount = (supplierId) => transactions.filter((t) => t.type === "IN" && (t.supplier_id === supplierId || t.supplierId === supplierId)).length;

  return (
    <div>
      <SectionHeader eyebrow="Vendors" title="Suppliers" action={
        isAdmin && <Button variant="amber" onClick={() => setShowForm((s) => !s)}>{showForm ? <X size={14} /> : <Plus size={14} />}{showForm ? "Cancel" : "Add supplier"}</Button>
      } />
      {isAdmin && showForm && (
        <Card style={{ marginBottom: 20 }}>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <Label>Supplier name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Metro Paper Trading" />
              </div>
              <div>
                <Label>Contact person</Label>
                <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <Button type="submit" variant="in"><Plus size={14} />Save supplier</Button>
          </form>
        </Card>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {suppliers.map((s) => (
          <Card key={s.id}>
            <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>{s.name}</div>
            {s.contact && <div style={{ fontSize: 13, color: T.textMuted }}>{s.contact}</div>}
            {s.phone && <div style={{ ...fontMono, fontSize: 12, color: T.textFaint, marginTop: 2 }}>{s.phone}</div>}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <Badge>{deliveryCount(s.id)} deliveries logged</Badge>
            </div>
          </Card>
        ))}
        {suppliers.length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>No suppliers yet.</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MOVEMENT VIEW
--------------------------------------------------------------- */
function MovementView({ products, suppliers, transactions, onLog, defaultStaff }) {
  const [type, setType] = useState("IN");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [staff, setStaff] = useState(defaultStaff || "");
  const [supplierId, setSupplierId] = useState("");
  const [price, setPrice] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (selectedProduct) setPrice(type === "OUT" ? selectedProduct.retail_price : selectedProduct.purchase_price);
  }, [productId, type]);

  async function submit(e) {
    e.preventDefault();
    if (!productId || !qty || !staff) return;
    const ok = await onLog({
      productId, type, qty: Number(qty), staff, supplierId: supplierId || null,
      price: Number(price), timestamp: timestamp ? new Date(timestamp).toISOString() : undefined,
    });
    if (ok !== false) { setQty(""); setSupplierId(""); setTimestamp(""); }
  }

  const filteredTxns = transactions.filter((t) => filterType === "ALL" || t.type === filterType);

  const typeLabels = {
    IN: { verb: "Received by", action: "Log stock in", button: "in" },
    OUT: { verb: "Released by", action: "Log stock out", button: "out" },
    DISCARD: { verb: "Reported by", action: "Log discarded / waste", button: "waste" },
  };

  return (
    <div>
      <SectionHeader eyebrow="Movement" title="Product in / out / discard log" />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Button variant={type === "IN" ? "in" : "ghost"} onClick={() => setType("IN")}><ArrowDownToLine size={14} />Product in</Button>
          <Button variant={type === "OUT" ? "out" : "ghost"} onClick={() => setType("OUT")}><ArrowUpFromLine size={14} />Product out</Button>
          <Button variant={type === "DISCARD" ? "waste" : "ghost"} onClick={() => setType("DISCARD")}><Trash2 size={14} />Discard / waste</Button>
        </div>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Product</Label>
              <Select required value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select a product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit || "pcs"} in stock)</option>)}
              </Select>
            </div>
            <div>
              <Label>Quantity{selectedProduct ? ` (${selectedProduct.unit || "pcs"})` : ""}</Label>
              <Input required type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>{type === "OUT" ? "Retail price (selling)" : type === "DISCARD" ? "Cost value (writing off)" : "Purchase price (from supplier)"}</Label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: type === "IN" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <Label>{typeLabels[type].verb}</Label>
              <Input required value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="Staff name" />
            </div>
            {type === "IN" && (
              <div>
                <Label>Supplier</Label>
                <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            )}
            <div>
              <Label>Timestamp (defaults to now)</Label>
              <Input type="datetime-local" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} />
            </div>
          </div>
          <Button type="submit" variant={typeLabels[type].button}>
            {type === "IN" ? <ArrowDownToLine size={14} /> : type === "OUT" ? <ArrowUpFromLine size={14} /> : <Trash2 size={14} />}
            {typeLabels[type].action}
          </Button>
        </form>
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Label>History</Label>
        <div style={{ display: "flex", gap: 6 }}>
          {["ALL", "IN", "OUT", "DISCARD"].map((f) => (
            <button key={f} onClick={() => setFilterType(f)} style={{
              ...fontMono, fontSize: 11, padding: "5px 10px", borderRadius: 3, cursor: "pointer",
              background: filterType === f ? T.surfaceRaised : "transparent",
              color: filterType === f ? T.text : T.textFaint,
              border: `1px solid ${filterType === f ? T.borderStrong : T.border}`,
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Type", "Product", "Qty", "Price", "Supplier", "Staff", "Timestamp"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 16px", ...fontMono, fontSize: 10, letterSpacing: "0.06em", color: T.textFaint, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTxns.map((t) => {
              const p = products.find((pp) => pp.id === (t.product_id || t.productId));
              const s = suppliers.find((ss) => ss.id === (t.supplier_id || t.supplierId));
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "10px 16px" }}><Badge tone={movementTone(t.type)}>{t.type}</Badge></td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.text }}>{p ? p.name : "Deleted product"}</td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: T.text }}>{t.qty} {p ? (p.unit || "pcs") : ""}</td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: T.textMuted }}>{fmtMoney(t.price)}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.textMuted }}>{s ? s.name : "\u2014"}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.textMuted }}>{t.staff}</td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 12, color: T.textFaint }}>{fmtDateTime(t.timestamp)}</td>
                </tr>
              );
            })}
            {filteredTxns.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: T.textFaint, fontSize: 13 }}>No movement recorded.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   BARCODE CONTROL VIEW
--------------------------------------------------------------- */
function BarcodeView({ products, onSetStatus, isAdmin }) {
  const [code, setCode] = useState("");
  const [match, setMatch] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  function lookup(e) {
    e.preventDefault();
    const found = products.find((p) => p.barcode === code.trim());
    if (found) { setMatch(found); setNotFound(false); }
    else { setMatch(null); setNotFound(true); }
  }

  useEffect(() => {
    if (match) {
      const fresh = products.find((p) => p.id === match.id);
      if (fresh) setMatch(fresh);
    }
  }, [products]);

  const held = products.filter((p) => p.status === "hold");
  const stopped = products.filter((p) => p.status === "stopped");

  const statusActions = {
    active: [{ status: "hold", label: "Put on hold", icon: AlertTriangle, variant: "amber" }, { status: "stopped", label: "Stop this product", icon: Ban, variant: "out" }],
    hold: [{ status: "active", label: "Reactivate", icon: RotateCcw, variant: "in" }, { status: "stopped", label: "Stop this product", icon: Ban, variant: "out" }],
    stopped: [{ status: "active", label: "Reactivate", icon: RotateCcw, variant: "in" }, { status: "hold", label: "Put on hold", icon: AlertTriangle, variant: "amber" }],
  };

  return (
    <div>
      <SectionHeader eyebrow="Access control" title="Barcode control" />
      <Card style={{ marginBottom: 20 }}>
        <Label>Scan or enter barcode</Label>
        <form onSubmit={lookup} style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <Input ref={inputRef} value={code} onChange={(e) => { setCode(e.target.value); setNotFound(false); }} placeholder="e.g. 041982773610" style={{ ...fontMono, maxWidth: 320 }} autoFocus />
          <Button type="submit" variant="amber"><Search size={14} />Look up</Button>
        </form>
        <div style={{ fontSize: 12, color: T.textFaint, marginTop: 8 }}>
          Scanning with a USB/Bluetooth barcode scanner works too \u2014 it types the digits and hits enter automatically.
        </div>
      </Card>

      {notFound && (
        <Card style={{ marginBottom: 20, borderColor: T.out }}>
          <div style={{ color: T.out, fontSize: 13 }}>No product matches that barcode.</div>
        </Card>
      )}

      {match && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ background: "#fff", padding: 12, borderRadius: 4 }}>
              <BarcodeSVG value={match.barcode} color="#141A22" width={200} height={50} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ ...fontDisplay, fontSize: 18, fontWeight: 700, color: T.text }}>{match.name}</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{match.category}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, ...fontMono, fontSize: 13, color: T.text, flexWrap: "wrap" }}>
                <span>{fmtMoney(match.retail_price)} <span style={{ color: T.textFaint, fontSize: 11 }}>retail</span></span>
                <span style={{ color: T.textFaint }}>{fmtMoney(match.purchase_price)} <span style={{ fontSize: 11 }}>cost</span></span>
                <span>{match.stock} {match.unit || "pcs"} in stock</span>
                <Badge tone={statusTone(match.status)}>{statusLabel(match.status)}</Badge>
              </div>
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {statusActions[match.status].map((a) => {
                  const Icon = a.icon;
                  return (
                    <Button key={a.status} variant={a.variant} onClick={() => onSetStatus(match.id, a.status)}>
                      <Icon size={14} />{a.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      <BarcodeDivider />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <Label>On hold ({held.length})</Label>
          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            {held.map((p) => (
              <Card key={p.id} style={{ borderColor: T.amber }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{p.name}</div>
                <div style={{ ...fontMono, fontSize: 11, color: T.textFaint, marginTop: 4 }}>{p.barcode}</div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <Button variant="ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => onSetStatus(p.id, "active")}>
                      <RotateCcw size={12} />Reactivate
                    </Button>
                    <Button variant="ghost" style={{ fontSize: 11, padding: "5px 10px", color: T.out }} onClick={() => onSetStatus(p.id, "stopped")}>
                      <Ban size={12} />Stop
                    </Button>
                  </div>
                )}
              </Card>
            ))}
            {held.length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>Nothing on hold.</div>}
          </div>
        </div>
        <div>
          <Label>Stopped ({stopped.length})</Label>
          <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
            {stopped.map((p) => (
              <Card key={p.id} style={{ borderColor: T.out }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{p.name}</div>
                <div style={{ ...fontMono, fontSize: 11, color: T.textFaint, marginTop: 4 }}>{p.barcode}</div>
                {isAdmin && (
                  <Button variant="ghost" style={{ marginTop: 10, fontSize: 11, padding: "5px 10px" }} onClick={() => onSetStatus(p.id, "active")}>
                    <RotateCcw size={12} />Reactivate
                  </Button>
                )}
              </Card>
            ))}
            {stopped.length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>No products are currently stopped.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   AGENTS VIEW (admin only) — add/remove agents, reset PINs
--------------------------------------------------------------- */
function AgentsView({ currentAgentName, showToast }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", pin: "", role: "user" });
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPin, setResetPin] = useState("");

  async function load() {
    setLoading(true);
    try {
      setAgents(await api.getAgents());
    } catch (err) {
      showToast(err.message, "out");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.pin) return;
    try {
      await api.addAgent(form);
      showToast(`${form.name} added`, "in");
      setForm({ name: "", pin: "", role: "user" });
      setShowForm(false);
      load();
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    if (!resetPin || resetPin.length < 4) return;
    try {
      await api.resetAgentPin(resetTarget.id, resetPin);
      showToast(`PIN reset for ${resetTarget.name}`, "in");
      setResetTarget(null);
      setResetPin("");
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  async function remove(agent) {
    if (!window.confirm(`Remove ${agent.name}? They won't be able to sign in anymore.`)) return;
    try {
      await api.removeAgent(agent.id);
      showToast(`${agent.name} removed`, "out");
      load();
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  return (
    <div>
      <SectionHeader eyebrow="Access" title="Agents" action={
        <Button variant="amber" onClick={() => setShowForm((s) => !s)}>{showForm ? <X size={14} /> : <Plus size={14} />}{showForm ? "Cancel" : "Add agent"}</Button>
      } />

      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20, maxWidth: 560, lineHeight: 1.6 }}>
        Each agent signs in with their own name and PIN. <b style={{ color: T.text, fontWeight: 500 }}>Admins</b> can
        add products and suppliers, stop or reactivate products, and manage the team here.{" "}
        <b style={{ color: T.text, fontWeight: 500 }}>Users</b> can view everything and log stock in / stock out.
      </div>

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <Label>Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jae" />
              </div>
              <div>
                <Label>PIN (min. 4 digits)</Label>
                <Input required type="password" inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="\u2022\u2022\u2022\u2022" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
            </div>
            <Button type="submit" variant="in"><Plus size={14} />Save agent</Button>
          </form>
        </Card>
      )}

      {resetTarget && (
        <Card style={{ marginBottom: 20 }}>
          <form onSubmit={submitReset}>
            <Label>Reset PIN for {resetTarget.name}</Label>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Input required type="password" inputMode="numeric" value={resetPin} onChange={(e) => setResetPin(e.target.value)} placeholder="New PIN" style={{ maxWidth: 200 }} autoFocus />
              <Button type="submit" variant="amber">Save</Button>
              <Button type="button" variant="ghost" onClick={() => { setResetTarget(null); setResetPin(""); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Name", "Role", "Added", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 16px", ...fontMono, fontSize: 10, letterSpacing: "0.06em", color: T.textFaint, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "10px 16px", fontSize: 13, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
                  {a.role === "admin" && <ShieldCheck size={13} color={T.amber} />}
                  {a.name}{a.name === currentAgentName && <span style={{ color: T.textFaint, fontSize: 11 }}>(you)</span>}
                </td>
                <td style={{ padding: "10px 16px" }}><Badge tone={a.role === "admin" ? "amber" : "default"}>{a.role}</Badge></td>
                <td style={{ padding: "10px 16px", ...fontMono, fontSize: 12, color: T.textFaint }}>{fmtDateTime(a.created_at)}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <Button variant="ghost" style={{ padding: "5px 10px", fontSize: 11, marginRight: 6 }} onClick={() => { setResetTarget(a); setResetPin(""); }}>
                    <KeyRound size={12} />Reset PIN
                  </Button>
                  {a.name !== currentAgentName && (
                    <Button variant="ghost" style={{ padding: "5px 10px", fontSize: 11, color: T.out }} onClick={() => remove(a)}>
                      <Trash2 size={12} />Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && agents.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: T.textFaint, fontSize: 13 }}>No agents yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
