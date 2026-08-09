import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  LayoutDashboard, Package, Truck, ArrowLeftRight, ScanBarcode, Plus, X,
  ArrowDownToLine, ArrowUpFromLine, Ban, RotateCcw, Search, AlertTriangle, CheckCircle2, LogOut,
  Users, KeyRound, Trash2, ShieldCheck, Pencil, Receipt, Minus, Palette, Download, ChevronDown, ChevronUp, Bluetooth, ArrowUpDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api, getToken, getAgentName, getAgentRole, setSession, clearSession } from "./api.js";

/* ---------------------------------------------------------------
   THEME — "warehouse control panel", with 5 selectable palettes
--------------------------------------------------------------- */
const THEMES = {
  black: {
    bg: "#141A22", surface: "#1B2330", surfaceRaised: "#232C3B", surfaceInput: "#1A212C",
    border: "#2E3948", borderStrong: "#3D4B5E",
    amber: "#F2B705", amberDim: "#8A6A0C", amberText: "#FBE29B",
    in: "#3FC79A", inDim: "#1E5C46", inText: "#B7F0DD",
    out: "#E8604C", outDim: "#6E2B21", outText: "#F6C4BA",
    waste: "#A87C5A", wasteDim: "#4A3826", wasteText: "#E4D0BA",
    text: "#EDEFF2", textMuted: "#8B96A5", textFaint: "#5A6473",
    mode: "dark",
  },
  white: {
    bg: "#F4F5F7", surface: "#FFFFFF", surfaceRaised: "#EEF0F3", surfaceInput: "#FFFFFF",
    border: "#DCE0E5", borderStrong: "#C0C6CE",
    amber: "#B8860B", amberDim: "#FBE8B0", amberText: "#6B4E06",
    in: "#1E9C6C", inDim: "#D7F3E8", inText: "#0F5C3F",
    out: "#D14D37", outDim: "#FBDDD6", outText: "#7A281B",
    waste: "#8A6440", wasteDim: "#EFE1D2", wasteText: "#5A4128",
    text: "#1B2330", textMuted: "#5A6473", textFaint: "#8B96A5",
    mode: "light",
  },
  green: {
    bg: "#0F1B14", surface: "#16261C", surfaceRaised: "#1E3327", surfaceInput: "#132018",
    border: "#2A4232", borderStrong: "#3B5A45",
    amber: "#F2B705", amberDim: "#8A6A0C", amberText: "#FBE29B",
    in: "#3FC79A", inDim: "#1E5C46", inText: "#B7F0DD",
    out: "#E8604C", outDim: "#6E2B21", outText: "#F6C4BA",
    waste: "#A87C5A", wasteDim: "#4A3826", wasteText: "#E4D0BA",
    text: "#E8F2EB", textMuted: "#8FAB98", textFaint: "#5C7A67",
    mode: "dark",
  },
  pink: {
    bg: "#FFF3F6", surface: "#FFFFFF", surfaceRaised: "#FDE9EF", surfaceInput: "#FFFFFF",
    border: "#F5CFDC", borderStrong: "#E8A9C0",
    amber: "#C9910A", amberDim: "#FCE8B0", amberText: "#6B4E06",
    in: "#1E9C6C", inDim: "#D7F3E8", inText: "#0F5C3F",
    out: "#D14D37", outDim: "#FBDDD6", outText: "#7A281B",
    waste: "#8A6440", wasteDim: "#EFE1D2", wasteText: "#5A4128",
    text: "#3B1F2B", textMuted: "#8A5A6E", textFaint: "#B98CA0",
    mode: "light",
  },
  blue: {
    bg: "#F0F6FC", surface: "#FFFFFF", surfaceRaised: "#E4EEF8", surfaceInput: "#FFFFFF",
    border: "#C9DCEE", borderStrong: "#A9C6E0",
    amber: "#C9910A", amberDim: "#FCE8B0", amberText: "#6B4E06",
    in: "#1E9C6C", inDim: "#D7F3E8", inText: "#0F5C3F",
    out: "#D14D37", outDim: "#FBDDD6", outText: "#7A281B",
    waste: "#8A6440", wasteDim: "#EFE1D2", wasteText: "#5A4128",
    text: "#1B2E3D", textMuted: "#5A7285", textFaint: "#8FA6B8",
    mode: "light",
  },
  elderly: {
    // Deep coffee/espresso background with cream text \u2014 chosen for high
    // contrast rather than the more muted tones the other dark themes use,
    // since contrast matters more than atmosphere here. Combined with the
    // Atkinson Hyperlegible font and a global size increase (see the
    // "theme-elderly" CSS class), this is meant to read easily at a glance.
    bg: "#241811", surface: "#332216", surfaceRaised: "#402B1A", surfaceInput: "#2B1D13",
    border: "#5C4530", borderStrong: "#7A5C3E",
    amber: "#F2B705", amberDim: "#5C4506", amberText: "#FFE8A3",
    in: "#4ADE80", inDim: "#1E4A30", inText: "#C3F5D6",
    out: "#F87171", outDim: "#5C2420", outText: "#FBD4D1",
    waste: "#E0AC69", wasteDim: "#4A3520", wasteText: "#F2DBB8",
    text: "#FBF3E9", textMuted: "#D9C4AC", textFaint: "#AD9276",
    mode: "dark",
    largeText: true,
  },
};

const THEME_ORDER = ["black", "white", "green", "pink", "blue", "elderly"];
const THEME_LABELS = { black: "Black", white: "White", green: "Green", pink: "Light pink", blue: "Light blue", elderly: "Elderly (large text)" };
const THEME_SWATCH = { black: "#141A22", white: "#FFFFFF", green: "#16261C", pink: "#FFD3E2", blue: "#CFE6FB", elderly: "#402B1A" };

// A single mutable palette object that every component reads from at render
// time. The App component re-applies the selected theme's values onto this
// object at the top of every render (before returning JSX), so switching
// themes just means updating a bit of state in App and letting React's
// normal render pass pick up the new colors everywhere.
const T = { ...THEMES.black };

const THEME_STORAGE_KEY = "stockline_theme";
function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && THEMES[saved]) return saved;
  } catch {}
  return "black";
}
function saveTheme(key) {
  try { localStorage.setItem(THEME_STORAGE_KEY, key); } catch {}
}

const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" };
const fontMono = { fontFamily: "'IBM Plex Mono', monospace" };
const fontBody = { fontFamily: "'Inter', sans-serif" };

const COMMON_UNITS = ["pcs", "kg", "g", "sack", "pack", "box", "ream", "liter", "roll", "dozen", "set", "bottle"];

const MOBILE_BREAKPOINT = 720;
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

// Collapses a multi-column form grid to a single column on mobile.
function gridCols(isMobile, desktopTemplate) {
  return isMobile ? "1fr" : desktopTemplate;
}

function statusTone(status) {  if (status === "active") return "in";
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
  const sign = v < 0 ? "-" : "";
  return sign + "\u20B1" + Math.abs(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
// Local (not UTC) YYYY-MM-DD / YYYY-MM \u2014 toISOString() always returns UTC,
// which silently shifts every date boundary by the browser's UTC offset
// (8 hours for Philippine time), sorting late-night/early-morning sales
// into the wrong day. These use the Date object's local getters instead,
// matching what the person actually sees on their clock.
function localDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function localMonthStr(d) {
  return localDateStr(d).slice(0, 7);
}
function periodKey(iso, granularity) {
  const d = new Date(iso);
  if (granularity === "daily") return localDateStr(d);
  if (granularity === "weekly") return localDateStr(startOfWeek(d));
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
    in: { bg: T.inDim, fg: T.inText, bd: T.in },
    out: { bg: T.outDim, fg: T.outText, bd: T.out },
    amber: { bg: T.amberDim, fg: T.amberText, bd: T.amber },
    waste: { bg: T.wasteDim, fg: T.wasteText, bd: T.waste },
  };
  const c = tones[tone];
  return (
    <span style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 3, padding: "2px 8px", fontSize: 11, ...fontMono, letterSpacing: "0.04em", textTransform: "uppercase", display: "inline-block" }}>
      {children}
    </span>
  );
}
function ThemeSwitcher({ themeKey, onChange, direction = "up", compact = false, align = "left" }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      {compact ? (
        <button onClick={() => setOpen((o) => !o)} style={{ background: "transparent", border: "none", color: T.textMuted, padding: 6, cursor: "pointer", display: "flex" }}>
          <Palette size={16} />
        </button>
      ) : (
        <Button
          variant="ghost"
          style={{ fontSize: 12, padding: "6px 10px", width: "100%", justifyContent: "center" }}
          onClick={() => setOpen((o) => !o)}
        >
          <Palette size={13} />Theme
        </Button>
      )}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", minWidth: 170, zIndex: 41,
            ...(align === "left" ? { left: 0 } : { right: 0 }),
            ...(direction === "up" ? { bottom: "110%", marginBottom: 6 } : { top: "110%", marginTop: 6 }),
            background: T.surfaceRaised, border: `1px solid ${T.borderStrong}`, borderRadius: 6, padding: 8,
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", gap: 3,
          }}>
            {THEME_ORDER.map((key) => (
              <button
                key={key}
                onClick={() => { onChange(key); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 4,
                  background: themeKey === key ? T.surface : "transparent",
                  border: `1px solid ${themeKey === key ? T.borderStrong : "transparent"}`,
                  cursor: "pointer", fontSize: 12, color: T.text, ...fontBody, textAlign: "left",
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: THEME_SWATCH[key], border: `1px solid ${T.border}`, flexShrink: 0 }} />
                {THEME_LABELS[key]}
                {themeKey === key && <CheckCircle2 size={12} color={T.amber} style={{ marginLeft: "auto" }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ConnectDeviceModal({ onClose, btDevice, onConnect, onDisconnect }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const btSupported = typeof navigator !== "undefined" && !!navigator.bluetooth;

  async function handlePair() {
    setError("");
    setConnecting(true);
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      onConnect({ name: device.name || "Unnamed device", id: device.id });
    } catch (err) {
      if (err.name !== "NotFoundError") setError(err.message || "Couldn't pair that device.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
      <Card style={{ position: "relative", maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bluetooth size={16} color={T.amber} />
            <div style={{ ...fontDisplay, fontSize: 16, fontWeight: 700, color: T.text }}>Connect a device</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ ...fontMono, fontSize: 11, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Barcode scanner</div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
            {"Pair it in your phone or computer's own Bluetooth settings, the same way you'd pair a wireless keyboard \u2014 no button needed here. Once paired, tap into any barcode field in the app and start scanning; it works with virtually any scanner."}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 16, paddingTop: 16 }}>
          <div style={{ ...fontMono, fontSize: 11, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Receipt printer</div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
            {"Most Bluetooth thermal receipt printers need a small print-service app installed on Android (e.g. \u201cESCPOS Bluetooth Print Service\u201d from Google Play) \u2014 pair your printer inside that app once, and it'll show up automatically when you tap Print receipt in Point of Sale. This is an Android/browser limitation, not something a website can bypass."}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 16, paddingTop: 16 }}>
          <div style={{ ...fontMono, fontSize: 11, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Advanced: pair a Bluetooth LE device directly</div>
          {!btSupported ? (
            <div style={{ fontSize: 13, color: T.textFaint, lineHeight: 1.6 }}>
              {"This browser doesn't support direct Bluetooth pairing (Safari and iPhone don't support this). Use Chrome or Edge on Android or a computer, or pair through your device's own Bluetooth settings instead."}
            </div>
          ) : btDevice ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Badge tone="in">Connected</Badge>
                <span style={{ fontSize: 13, color: T.text }}>{btDevice.name}</span>
              </div>
              <Button variant="ghost" onClick={onDisconnect}><X size={13} />Disconnect</Button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
                {"For newer BLE-based scanners or printers, you can pair directly here. This won't work with most cheap Bluetooth Classic thermal printers \u2014 use the print-service app above for those."}
              </div>
              <Button variant="amber" onClick={handlePair} disabled={connecting}>
                <Bluetooth size={14} />{connecting ? "Pairing\u2026" : "Pair Bluetooth device"}
              </Button>
              {error && <div style={{ color: T.out, fontSize: 12, marginTop: 8 }}>{error}</div>}
            </>
          )}
        </div>
      </Card>
    </div>
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

/* Admin-only control to permanently purge movement history before a chosen
   date. Shared between the Dashboard and Movement log views. */
function DangerZoneCard({ transactions, onDeleteRange }) {
  const [mode, setMode] = useState("date"); // "date" | "month" | "all"
  const [dateVal, setDateVal] = useState("");
  const [monthVal, setMonthVal] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  function rangeFor(m, dv, mv) {
    if (m === "all") return { after: null, before: null, all: true };
    if (m === "date" && dv) {
      const next = new Date(dv + "T00:00:00");
      next.setDate(next.getDate() + 1);
      return { after: dv, before: localDateStr(next), all: false };
    }
    if (m === "month" && mv) {
      const [y, mo] = mv.split("-").map(Number);
      const next = new Date(y, mo, 1); // mo is 1-indexed here, so this lands on the 1st of next month
      return { after: `${mv}-01`, before: localDateStr(next), all: false };
    }
    return null;
  }

  const range = rangeFor(mode, dateVal, monthVal);
  const ready = mode === "all" || !!range;

  // Live preview computed from data already loaded client-side \u2014 shows
  // exactly how many entries are about to be deleted BEFORE the person
  // confirms, so the scope of a bulk delete is never a surprise.
  const previewCount = !ready ? 0 : transactions.filter((t) => {
    if (mode === "all") return true;
    const time = new Date(t.timestamp).getTime();
    const afterOk = !range.after || time >= new Date(range.after + "T00:00:00").getTime();
    const beforeOk = !range.before || time < new Date(range.before + "T00:00:00").getTime();
    return afterOk && beforeOk;
  }).length;

  function describeScope() {
    if (mode === "all") return "your ENTIRE movement history";
    if (mode === "date") return `everything logged on ${dateVal}`;
    if (mode === "month") return `everything logged in ${monthVal}`;
    return "";
  }

  function reset() {
    setDateVal(""); setMonthVal(""); setConfirmText("");
  }

  async function handleDelete() {
    setBusy(true);
    const params = mode === "all" ? { all: "true" } : { after: range.after, before: range.before };
    const ok = await onDeleteRange(params);
    setBusy(false);
    if (ok) reset();
  }

  return (
    <Card style={{ borderColor: T.outDim }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <AlertTriangle size={15} color={T.out} />
        <div style={{ ...fontDisplay, fontSize: 14, fontWeight: 700, color: T.out }}>Danger zone</div>
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
        {"Permanently deletes movement history \u2014 useful for clearing out old test data. This does not change current stock levels, only the historical log and the dashboard's totals/chart. Every delete here is recorded in the Void log."}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { key: "date", label: "By date" },
          { key: "month", label: "By month" },
          { key: "all", label: "Everything" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); reset(); }}
            style={{
              ...fontMono, fontSize: 11, padding: "6px 12px", borderRadius: 3, cursor: "pointer",
              background: mode === m.key ? T.outDim : "transparent",
              color: mode === m.key ? T.out : T.textFaint,
              border: `1px solid ${mode === m.key ? T.out : T.border}`,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "date" && (
        <div style={{ marginBottom: 14 }}>
          <Label>Date to delete</Label>
          <Input type="date" value={dateVal} onChange={(e) => { setDateVal(e.target.value); setConfirmText(""); }} style={{ width: 160 }} />
        </div>
      )}
      {mode === "month" && (
        <div style={{ marginBottom: 14 }}>
          <Label>Month to delete</Label>
          <Input type="month" value={monthVal} onChange={(e) => { setMonthVal(e.target.value); setConfirmText(""); }} style={{ width: 160 }} />
        </div>
      )}

      {ready && (
        <div style={{ background: T.surfaceInput, border: `1px solid ${T.outDim}`, borderRadius: 4, padding: 14 }}>
          <div style={{ fontSize: 13, color: T.text, marginBottom: 4 }}>
            This will permanently delete <b style={{ color: T.out }}>{previewCount} {previewCount === 1 ? "entry" : "entries"}</b> {"\u2014"} {describeScope()}.
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
            This can't be undone. Type <b style={{ ...fontMono }}>DELETE</b> to confirm.
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              style={{ maxWidth: 160, ...fontMono }}
            />
            <Button
              variant="out"
              disabled={confirmText !== "DELETE" || busy || previewCount === 0}
              onClick={handleDelete}
            >
              <Trash2 size={13} />{busy ? "Deleting\u2026" : `Permanently delete ${previewCount > 0 ? previewCount : ""}`}
            </Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------
   LOGIN
--------------------------------------------------------------- */
function Login({ onLoggedIn, themeKey, applyTheme }) {
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
    <div className={themeKey === "elderly" ? "theme-elderly" : ""} style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box", position: "relative", ...fontBody }}>
      {applyTheme && (
        <div style={{ position: "absolute", top: 20, right: 20, width: 140 }}>
          <ThemeSwitcher themeKey={themeKey} onChange={applyTheme} direction="down" align="right" />
        </div>
      )}
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 320, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 28, boxSizing: "border-box" }}>
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
  const [themeKey, setThemeKey] = useState(getSavedTheme);
  Object.assign(T, THEMES[themeKey]); // apply before this render's JSX (and all children) read T.*
  function applyTheme(key) {
    setThemeKey(key);
    saveTheme(key);
  }

  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [btDevice, setBtDevice] = useState(null);

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

  async function editSupplier(id, sup) {
    try {
      const updated = await api.editSupplier(id, sup);
      setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
      showToast(`${updated.name} updated`, "in");
      return true;
    } catch (err) {
      showToast(err.message, "out");
      return false;
    }
  }

  async function deleteSupplier(id, name) {
    try {
      await api.deleteSupplier(id);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      showToast(`${name} deleted`, "out");
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  async function addProduct(prod) {
    try {
      const created = await api.addProduct(prod);
      setProducts((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
      showToast("Product added to inventory", "in");
    } catch (err) {
      showToast(err.message, "out");
    }
  }

  async function editProduct(id, prod) {
    try {
      const updated = await api.editProduct(id, prod);
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      showToast(`${updated.name} updated`, "in");
      return true;
    } catch (err) {
      showToast(err.message, "out");
      return false;
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

  async function deleteTransactionsRange(params) {
    try {
      const res = await api.deleteTransactionsRange(params);
      const state = await api.getState();
      setTransactions(state.transactions);
      setProducts(state.products);
      setSuppliers(state.suppliers);
      showToast(`Deleted ${res.deleted} movement ${res.deleted === 1 ? "entry" : "entries"}`, "out");
      return true;
    } catch (err) {
      showToast(err.message, "out");
      return false;
    }
  }

  async function deleteTransaction(id) {
    try {
      await api.deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      showToast("Entry deleted", "out");
      return true;
    } catch (err) {
      showToast(err.message, "out");
      return false;
    }
  }

  async function logMovement(entry) {
    try {
      const res = await api.logTransaction(entry);
      // Insert in timestamp order (not just prepended) so backdated entries
      // land in the right spot instead of jumping to the top of the list.
      setTransactions((t) => [...t, res.transaction].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
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
    { key: "pos", label: "Point of sale", icon: Receipt },
    { key: "products", label: "Products", icon: Package },
    { key: "suppliers", label: "Suppliers", icon: Truck },
    { key: "movement", label: "Movement log", icon: ArrowLeftRight },
    { key: "barcode", label: "Barcode control", icon: ScanBarcode },
    ...(isAdmin ? [{ key: "agents", label: "Agents", icon: Users }] : []),
    ...(isAdmin ? [{ key: "voidlog", label: "Void log", icon: ShieldCheck }] : []),
  ];

  const isMobile = useIsMobile();

  if (!agentName) {
    return <Login onLoggedIn={setAgentName} themeKey={themeKey} applyTheme={applyTheme} />;
  }

  if (!ready) {
    return (
      <div style={{ background: T.bg, minHeight: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: T.textMuted, ...fontMono, gap: 12 }}>
        {loadError ? <div style={{ color: T.out }}>{loadError}</div> : "loading inventory..."}
      </div>
    );
  }

  const currentNavLabel = navItems.find((n) => n.key === view)?.label || "STOCKLINE";

  const mainContent = (
    <>
      {view === "dashboard" && <Dashboard products={products} transactions={transactions} suppliers={suppliers} isAdmin={isAdmin} onDeleteRange={deleteTransactionsRange} isMobile={isMobile} showToast={showToast} />}
      {view === "pos" && <PosView products={products} staffName={agentName} onLog={logMovement} isMobile={isMobile} />}
      {view === "products" && <ProductsView products={products} categories={categories} onAdd={addProduct} onEdit={editProduct} onSetStatus={setProductStatus} onDelete={deleteProduct} isAdmin={isAdmin} isMobile={isMobile} />}
      {view === "suppliers" && <SuppliersView suppliers={suppliers} products={products} transactions={transactions} onAdd={addSupplier} onEdit={editSupplier} onDelete={deleteSupplier} isAdmin={isAdmin} isMobile={isMobile} />}
      {view === "movement" && <MovementView products={products} suppliers={suppliers} transactions={transactions} onLog={logMovement} defaultStaff={agentName} isAdmin={isAdmin} onDeleteRange={deleteTransactionsRange} onDeleteOne={deleteTransaction} isMobile={isMobile} />}
      {view === "barcode" && <BarcodeView products={products} onSetStatus={setProductStatus} onLog={logMovement} staffName={agentName} isAdmin={isAdmin} isMobile={isMobile} />}
      {view === "agents" && isAdmin && <AgentsView currentAgentName={agentName} showToast={showToast} isMobile={isMobile} />}
      {view === "voidlog" && isAdmin && <VoidLogView products={products} showToast={showToast} isMobile={isMobile} />}
    </>
  );

  const toastEl = toast && (
    <div style={{
      position: "fixed", top: isMobile ? 60 : 20, left: isMobile ? 12 : "auto", right: isMobile ? 12 : 28, zIndex: 30,
      background: toast.tone === "in" ? T.inDim : toast.tone === "out" ? T.outDim : T.surfaceRaised,
      border: `1px solid ${toast.tone === "in" ? T.in : toast.tone === "out" ? T.out : T.border}`,
      color: T.text, padding: "10px 16px", borderRadius: 4, fontSize: 13, ...fontBody,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {toast.tone === "in" ? <CheckCircle2 size={15} color={T.in} /> : toast.tone === "out" ? <AlertTriangle size={15} color={T.out} /> : null}
      {toast.msg}
    </div>
  );

  if (isMobile) {
    return (
      <div className={themeKey === "elderly" ? "theme-elderly" : ""} style={{ background: T.bg, minHeight: "100vh", ...fontBody }}>
        {/* Top bar */}
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 52, zIndex: 20,
          background: T.surface, borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <ScanBarcode size={16} color={T.amber} style={{ flexShrink: 0 }} />
            <span style={{ ...fontDisplay, fontWeight: 700, fontSize: 14, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {currentNavLabel}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Badge tone={isAdmin ? "amber" : "default"}>{agentName}</Badge>
            <ThemeSwitcher themeKey={themeKey} onChange={applyTheme} direction="down" align="right" compact />
            <button onClick={() => setShowDeviceModal(true)} style={{ background: "transparent", border: "none", color: T.textMuted, padding: 6, cursor: "pointer", display: "flex", position: "relative" }}>
              <Bluetooth size={16} />
              {btDevice && <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: T.in }} />}
            </button>
            <button onClick={logout} style={{ background: "transparent", border: "none", color: T.textMuted, padding: 6, cursor: "pointer", display: "flex" }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {showDeviceModal && (
          <ConnectDeviceModal
            onClose={() => setShowDeviceModal(false)}
            btDevice={btDevice}
            onConnect={(d) => setBtDevice(d)}
            onDisconnect={() => setBtDevice(null)}
          />
        )}

        {toastEl}

        {/* Content */}
        <div style={{ paddingTop: 68, paddingBottom: 76, paddingLeft: 14, paddingRight: 14 }}>
          {mainContent}
        </div>

        {/* Bottom tab bar */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
          background: T.surface, borderTop: `1px solid ${T.border}`,
          display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  padding: "9px 2px 8px", background: "transparent", border: "none", cursor: "pointer",
                  color: active ? T.amber : T.textFaint,
                }}
              >
                <Icon size={19} />
                <span style={{ ...fontMono, fontSize: 9, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                  {item.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={themeKey === "elderly" ? "theme-elderly" : ""} style={{ background: T.bg, minHeight: "100vh", display: "flex", ...fontBody }}>
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
            <div style={{ marginBottom: 6 }}>
              <ThemeSwitcher themeKey={themeKey} onChange={applyTheme} direction="up" />
            </div>
            <div style={{ marginBottom: 6 }}>
              <Button variant="ghost" style={{ fontSize: 12, padding: "6px 10px", width: "100%", justifyContent: "center" }} onClick={() => setShowDeviceModal(true)}>
                <Bluetooth size={13} />Connect device
                {btDevice && <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.in, marginLeft: 4 }} />}
              </Button>
            </div>
            <Button variant="ghost" style={{ fontSize: 12, padding: "6px 10px", width: "100%", justifyContent: "center" }} onClick={logout}>
              <LogOut size={13} />Sign out
            </Button>
          </div>
        </div>
      </div>

      {showDeviceModal && (
        <ConnectDeviceModal
          onClose={() => setShowDeviceModal(false)}
          btDevice={btDevice}
          onConnect={(d) => setBtDevice(d)}
          onDisconnect={() => setBtDevice(null)}
        />
      )}

      <div style={{ flex: 1, padding: 28, minWidth: 0, position: "relative" }}>
        {toastEl}
        {mainContent}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   DASHBOARD
--------------------------------------------------------------- */
function Dashboard({ products, transactions, suppliers, isAdmin, onDeleteRange, isMobile, showToast }) {
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
  const totalStockCostValue = products.reduce((s, p) => s + p.stock * p.purchase_price, 0);
  const lowStock = activeProducts.filter((p) => p.stock > 0 && p.stock <= 10);
  const outOfStock = activeProducts.filter((p) => p.stock === 0);

  const findProduct = (t) => products.find((pp) => pp.id === (t.product_id || t.productId));

  const today = new Date();
  const todayStr = localDateStr(today);
  const thisMonthStr = localMonthStr(today);
  const thisYearStr = String(today.getFullYear());

  const [statsMode, setStatsMode] = useState("all"); // all | day | month | year
  const [statsDay, setStatsDay] = useState(todayStr);
  const [statsMonth, setStatsMonth] = useState(thisMonthStr);
  const [statsYear, setStatsYear] = useState(thisYearStr);

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map((t) => String(new Date(t.timestamp).getFullYear())));
    years.add(thisYearStr);
    return [...years].sort((a, b) => b - a);
  }, [transactions]);

  const periodTransactions = useMemo(() => {
    if (statsMode === "all") return transactions;
    return transactions.filter((t) => {
      const d = new Date(t.timestamp);
      if (statsMode === "day") return localDateStr(d) === statsDay;
      if (statsMode === "month") return localMonthStr(d) === statsMonth;
      if (statsMode === "year") return String(d.getFullYear()) === statsYear;
      return true;
    });
  }, [transactions, statsMode, statsDay, statsMonth, statsYear]);

  const periodLabelText = useMemo(() => {
    if (statsMode === "all") return "All time";
    if (statsMode === "day") return new Date(statsDay + "T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
    if (statsMode === "month") return new Date(statsMonth + "-01T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long" });
    return statsYear;
  }, [statsMode, statsDay, statsMonth, statsYear]);

  const totalRetailSales = useMemo(
    () => periodTransactions.filter((t) => t.type === "OUT" && t.price_type !== "market").reduce((s, t) => s + t.price * t.qty, 0),
    [periodTransactions]
  );
  const totalMarketSales = useMemo(
    () => periodTransactions.filter((t) => t.type === "OUT" && t.price_type === "market").reduce((s, t) => s + t.price * t.qty, 0),
    [periodTransactions]
  );
  const totalDiscarded = useMemo(
    () => periodTransactions.filter((t) => t.type === "DISCARD").reduce((s, t) => s + t.price * t.qty, 0),
    [periodTransactions]
  );

  const totalSalesRevenue = totalRetailSales + totalMarketSales;

  const stats = [
    { label: "Stock cost (supplier rate)", value: fmtMoney(totalStockCostValue), alwaysCurrent: true },
    { label: "Retail sales", value: fmtMoney(totalRetailSales) },
    { label: "Market sales", value: fmtMoney(totalMarketSales) },
    { label: "Lost / discarded", value: fmtMoney(totalDiscarded), warn: true },
    { label: "Total sales / revenue", value: fmtMoney(totalSalesRevenue) },
  ];

  return (
    <div>
      <SectionHeader eyebrow="Overview" title="Inventory dashboard" action={
        <Button variant="ghost" onClick={() => downloadAllData(products, suppliers, transactions, showToast)}>
          <Download size={14} />Download all data
        </Button>
      } />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "day", "month", "year"].map((m) => (
            <button key={m} onClick={() => setStatsMode(m)} style={{
              ...fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
              padding: "6px 12px", borderRadius: 3, cursor: "pointer",
              background: statsMode === m ? T.amber : "transparent",
              color: statsMode === m ? "#241B02" : T.textMuted,
              border: `1px solid ${statsMode === m ? T.amber : T.border}`,
            }}>
              {m === "all" ? "All time" : m}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {statsMode === "day" && (
            <Input type="date" value={statsDay} onChange={(e) => setStatsDay(e.target.value)} style={{ width: 160 }} />
          )}
          {statsMode === "month" && (
            <Input type="month" value={statsMonth} onChange={(e) => setStatsMonth(e.target.value)} style={{ width: 160 }} />
          )}
          {statsMode === "year" && (
            <Select value={statsYear} onChange={(e) => setStatsYear(e.target.value)} style={{ width: 120 }}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          )}
          <span style={{ ...fontMono, fontSize: 11, color: T.textFaint }}>Showing: {periodLabelText}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        {stats.map((s) => (
          <Card key={s.label} style={{ padding: 16 }}>
            <Label>{s.label}</Label>
            <div style={{ ...fontDisplay, fontSize: s.plain ? 26 : 22, fontWeight: 700, color: s.negative ? T.out : s.warn ? T.waste : T.text }}>{s.value}</div>
            {s.alwaysCurrent && statsMode !== "all" && (
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>current, not filtered by period</div>
            )}
            {s.mixedPeriod && statsMode !== "all" && (
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>sales for this period, stock cost is current</div>
            )}
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

      <div style={{ display: "grid", gridTemplateColumns: gridCols(isMobile, "1fr 1fr"), gap: 16 }}>
        <Card>
          <Label>{"Low stock (\u226410 units)"}</Label>
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

      {isAdmin && (
        <>
          <BarcodeDivider />
          <DangerZoneCard transactions={transactions} onDeleteRange={onDeleteRange} />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   PRODUCTS VIEW
--------------------------------------------------------------- */
function ProductsView({ products, categories, onAdd, onEdit, onSetStatus, onDelete, isAdmin, isMobile }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", category: "", purchasePrice: "", retailPrice: "", marketPrice: "", stock: "", barcode: "", unit: "pcs" });
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc" — by product name
  const [filterUnit, setFilterUnit] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const emptyForm = { name: "", category: "", purchasePrice: "", retailPrice: "", marketPrice: "", stock: "", barcode: "", unit: "pcs" };

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(p) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      unit: p.unit || "pcs",
      purchasePrice: String(p.purchase_price),
      retailPrice: String(p.retail_price),
      marketPrice: p.market_price != null ? String(p.market_price) : "",
      stock: String(p.stock),
      barcode: p.barcode,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.category || !form.purchasePrice || !form.retailPrice) return;
    if (editingId) {
      const ok = await onEdit(editingId, form);
      if (ok !== false) closeForm();
    } else {
      onAdd(form);
      closeForm();
    }
  }

  const unitOptions = [...new Set(products.map((p) => p.unit).filter(Boolean))].sort();

  const filtered = products
    .filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase()) ||
      p.barcode.includes(query)
    )
    .filter((p) => !filterUnit || p.unit === filterUnit)
    .filter((p) => !filterCategory || p.category === filterCategory)
    .sort((a, b) => sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

  return (
    <div>
      <SectionHeader eyebrow="Catalog" title="Products" action={
        isAdmin && (
          <Button variant="amber" onClick={() => (showForm ? closeForm() : openAddForm())}>
            {showForm ? <X size={14} /> : <Plus size={14} />}{showForm ? "Cancel" : "Add product"}
          </Button>
        )
      } />

      {isAdmin && showForm && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ ...fontMono, fontSize: 11, color: T.amber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            {editingId ? "Editing product" : "New product"}
          </div>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: gridCols(isMobile, "2fr 1fr 1fr"), gap: 12, marginBottom: 12 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: gridCols(isMobile, "1fr 1fr 1fr 1fr"), gap: 12, marginBottom: 12 }}>
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
                <Label>{editingId ? "Stock" : "Starting stock"}</Label>
                <Input type="number" step="any" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div style={{ marginBottom: 14, maxWidth: 260 }}>
              <Label>Barcode{editingId ? "" : " (leave blank to auto-generate)"}</Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="auto" style={fontMono} />
            </div>
            {editingId && (
              <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 14 }}>
                {"Changing Stock here overwrites the count directly and doesn't create a Movement log entry. For a running record of who moved stock and when, log it as a stock in/out/discard entry instead \u2014 use this field only to correct a wrong number."}
              </div>
            )}
            <Button type="submit" variant="in">
              {editingId ? <><Pencil size={14} />Save changes</> : <><Plus size={14} />Save product</>}
            </Button>
          </form>
        </Card>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ maxWidth: 320, flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={14} color="#5A7285" style={{ position: "absolute", left: 10, top: 11 }} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, category, or barcode"
            style={{ paddingLeft: 30, background: "#DCEEFB", borderColor: "#A9C6E0", color: "#1B2E3D" }}
          />
        </div>
        <Button variant="ghost" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          <ArrowUpDown size={13} />Name {sortDir === "asc" ? "A\u2192Z" : "Z\u2192A"}
        </Button>
        <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ width: 170 }}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} style={{ width: 140 }}>
          <option value="">All units</option>
          {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </Select>
        {(filterCategory || filterUnit || query) && (
          <Button variant="ghost" onClick={() => { setFilterCategory(""); setFilterUnit(""); setQuery(""); }}>
            <X size={13} />Clear
          </Button>
        )}
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
                      <>
                        <Button
                          variant="ghost"
                          style={{ padding: "5px 10px", fontSize: 11, marginRight: 6 }}
                          onClick={() => openEditForm(p)}
                        >
                          <Pencil size={12} />Edit
                        </Button>
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
                      </>
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
function downloadAllData(products, suppliers, transactions, showToast) {
  try {
    const wb = XLSX.utils.book_new();

    const productRows = products.map((p) => ({
      Barcode: p.barcode, Name: p.name, Category: p.category, Unit: p.unit,
      "Purchase Price": p.purchase_price, "Retail Price": p.retail_price, "Market Price": p.market_price,
      Stock: p.stock, Status: p.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), "Products");

    const supplierRows = suppliers.map((s) => ({ Name: s.name, Contact: s.contact, Phone: s.phone }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supplierRows), "Suppliers");

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    const supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s]));
    const txnRows = transactions.map((t) => {
      const p = productMap[t.product_id || t.productId];
      const s = supplierMap[t.supplier_id || t.supplierId];
      return {
        Type: t.type, Product: p ? p.name : "Deleted product", Quantity: t.qty, Unit: p ? p.unit : "",
        Price: t.price, "Market Price": t.market_price ?? "", Customer: t.customer_name || "", Supplier: s ? s.name : "",
        Staff: t.staff, Timestamp: t.timestamp,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows), "Movement Log");

    XLSX.writeFile(wb, `stockline-export-${localDateStr(new Date())}.xlsx`);
    if (showToast) showToast("Export downloaded", "in");
  } catch (err) {
    console.error("Export failed:", err);
    if (showToast) showToast(`Export failed: ${err.message || "unknown error"}`, "out");
    else alert(`Export failed: ${err.message || "unknown error"}`);
  }
}

function SuppliersView({ suppliers, products, transactions, onAdd, onEdit, onDelete, isAdmin, isMobile }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", contact: "", phone: "" });
  const [expandedId, setExpandedId] = useState(null);

  function openAddForm() {
    setEditingId(null);
    setForm({ name: "", contact: "", phone: "" });
    setShowForm(true);
  }
  function openEditForm(s) {
    setEditingId(s.id);
    setForm({ name: s.name, contact: s.contact || "", phone: s.phone || "" });
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", contact: "", phone: "" });
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name) return;
    if (editingId) {
      const ok = await onEdit(editingId, form);
      if (ok !== false) closeForm();
    } else {
      onAdd(form);
      closeForm();
    }
  }

  const deliveryCount = (supplierId) => transactions.filter((t) => t.type === "IN" && (t.supplier_id === supplierId || t.supplierId === supplierId)).length;

  function suppliedProducts(supplierId) {
    const ids = new Set(
      transactions.filter((t) => t.type === "IN" && (t.supplier_id === supplierId || t.supplierId === supplierId))
        .map((t) => t.product_id || t.productId)
    );
    return products.filter((p) => ids.has(p.id));
  }

  return (
    <div>
      <SectionHeader eyebrow="Vendors" title="Suppliers" action={
        isAdmin && (
          <Button variant="amber" onClick={() => (showForm ? closeForm() : openAddForm())}>
            {showForm ? <X size={14} /> : <Plus size={14} />}{showForm ? "Cancel" : "Add supplier"}
          </Button>
        )
      } />
      {isAdmin && showForm && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ ...fontMono, fontSize: 11, color: T.amber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            {editingId ? "Editing supplier" : "New supplier"}
          </div>
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: gridCols(isMobile, "2fr 1fr 1fr"), gap: 12, marginBottom: 14 }}>
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
            <Button type="submit" variant="in">{editingId ? <><Pencil size={14} />Save changes</> : <><Plus size={14} />Save supplier</>}</Button>
          </form>
        </Card>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {suppliers.map((s) => {
          const items = suppliedProducts(s.id);
          const expanded = expandedId === s.id;
          return (
            <Card key={s.id}>
              <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>{s.name}</div>
              {s.contact && <div style={{ fontSize: 13, color: T.textMuted }}>{s.contact}</div>}
              {s.phone && <div style={{ ...fontMono, fontSize: 12, color: T.textFaint, marginTop: 2 }}>{s.phone}</div>}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <Badge>{deliveryCount(s.id)} deliveries logged</Badge>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button variant="ghost" style={{ padding: "5px 8px", fontSize: 11 }} onClick={() => openEditForm(s)}>
                      <Pencil size={12} />Edit
                    </Button>
                    <Button
                      variant="ghost"
                      style={{ padding: "5px 8px", fontSize: 11, color: T.out }}
                      onClick={() => {
                        if (window.confirm(`Delete "${s.name}"? This can't be undone. Past movement history will show it as a deleted supplier instead of being removed.`)) {
                          onDelete(s.id, s.name);
                        }
                      }}
                    >
                      <Trash2 size={12} />Delete
                    </Button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setExpandedId(expanded ? null : s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, marginTop: 10, background: "transparent", border: "none",
                  color: T.textMuted, cursor: "pointer", fontSize: 12, padding: 0, ...fontBody,
                }}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {items.length} product{items.length === 1 ? "" : "s"} from this supplier
              </button>
              {expanded && (
                <div style={{ marginTop: 8 }}>
                  {items.length === 0 ? (
                    <div style={{ fontSize: 12, color: T.textFaint }}>No stock-in deliveries logged for this supplier yet.</div>
                  ) : (
                    items.map((p) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                        <span style={{ color: T.text }}>{p.name}</span>
                        <span style={{ ...fontMono, color: T.textFaint }}>{p.stock} {p.unit || "pcs"}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {suppliers.length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>No suppliers yet.</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MOVEMENT VIEW
--------------------------------------------------------------- */
function MovementView({ products, suppliers, transactions, onLog, defaultStaff, isAdmin, onDeleteRange, onDeleteOne, isMobile }) {
  const [type, setType] = useState("IN");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [staff, setStaff] = useState(defaultStaff || "");
  const [supplierId, setSupplierId] = useState("");
  const [price, setPrice] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    if (selectedProduct) setPrice(selectedProduct.purchase_price);
  }, [productId, type]);

  async function submit(e) {
    e.preventDefault();
    if (!productId || !qty || !staff) return;
    const ok = await onLog({
      productId, type, qty: Number(qty), staff, supplierId: supplierId || null,
      price: Number(price),
      timestamp: timestamp ? new Date(timestamp).toISOString() : undefined,
    });
    if (ok !== false) { setQty(""); setSupplierId(""); setTimestamp(""); }
  }

  const customerNames = [...new Set(transactions.filter((t) => t.customer_name).map((t) => t.customer_name))].sort();

  const filteredTxns = transactions.filter((t) => {
    if (filterType === "OUT_RETAIL") {
      if (!(t.type === "OUT" && t.price_type !== "market")) return false;
    } else if (filterType === "OUT_MARKET") {
      if (!(t.type === "OUT" && t.price_type === "market")) return false;
    } else if (filterType !== "ALL" && t.type !== filterType) {
      return false;
    }
    if (customerFilter && t.customer_name !== customerFilter) return false;
    const tTime = new Date(t.timestamp).getTime();
    if (dateFrom && tTime < new Date(dateFrom + "T00:00:00").getTime()) return false;
    if (dateTo && tTime > new Date(dateTo + "T23:59:59.999").getTime()) return false;
    return true;
  });
  const filteredTotal = filteredTxns.reduce((s, t) => s + t.price * t.qty, 0);

  const typeLabels = {
    IN: { verb: "Received by", action: "Log stock in", button: "in" },
    OUT: { verb: "Released by", action: "Log stock out", button: "out" },
    DISCARD: { verb: "Reported by", action: "Log discarded / waste", button: "waste" },
  };

  return (
    <div>
      <SectionHeader eyebrow="Movement" title="Product in / discard log" />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>
          {"Selling stock now happens through Point of Sale, which prints a receipt and logs the sale automatically. Use this page for restocking and writing off damaged or expired goods."}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Button variant={type === "IN" ? "in" : "ghost"} onClick={() => setType("IN")}><ArrowDownToLine size={14} />Product in</Button>
          <Button variant={type === "DISCARD" ? "waste" : "ghost"} onClick={() => setType("DISCARD")}><Trash2 size={14} />Discard / waste</Button>
        </div>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: gridCols(isMobile, "2fr 1fr 1fr"), gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Product</Label>
              <Select required value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select a product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit || "pcs"} in stock)</option>)}
              </Select>
            </div>
            <div>
              <Label>Quantity{selectedProduct ? ` (${selectedProduct.unit || "pcs"})` : ""}</Label>
              <Input required type="number" step="any" min="0.001" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>{type === "DISCARD" ? "Cost value (writing off)" : "Purchase price (from supplier)"}</Label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: gridCols(isMobile, type === "IN" ? "1fr 1fr 1fr" : "1fr 1fr"), gap: 12, marginBottom: 14 }}>
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Label>History</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "ALL", label: "ALL" },
              { key: "IN", label: "IN" },
              { key: "OUT", label: "OUT" },
              { key: "OUT_RETAIL", label: "OUT \u00b7 RETAIL" },
              { key: "OUT_MARKET", label: "OUT \u00b7 MARKET" },
              { key: "DISCARD", label: "DISCARD" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilterType(key)} style={{
                ...fontMono, fontSize: 11, padding: "5px 10px", borderRadius: 3, cursor: "pointer",
                background: filterType === key ? T.surfaceRaised : "transparent",
                color: filterType === key ? T.text : T.textFaint,
                border: `1px solid ${filterType === key ? T.borderStrong : T.border}`,
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          {customerNames.length > 0 && (
            <div>
              <Label>Customer</Label>
              <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} style={{ width: 170 }}>
                <option value="">All customers</option>
                {customerNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          )}
          <div>
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 150 }} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: 150 }} />
          </div>
          {(dateFrom || dateTo || customerFilter) && (
            <Button variant="ghost" style={{ padding: "9px 12px", fontSize: 12 }} onClick={() => { setDateFrom(""); setDateTo(""); setCustomerFilter(""); }}>
              <X size={12} />Clear
            </Button>
          )}
        </div>
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
        background: T.surfaceRaised, border: `1px solid ${T.amber}`, borderRadius: 6, padding: "12px 16px", marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, color: T.textMuted }}>
          Showing {filteredTxns.length} {filteredTxns.length === 1 ? "entry" : "entries"}
          {dateFrom ? ` from ${dateFrom}` : ""}{dateTo ? ` to ${dateTo}` : ""}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ ...fontMono, fontSize: 11, color: T.textFaint, letterSpacing: "0.06em", textTransform: "uppercase" }}>Total</span>
          <span style={{ ...fontDisplay, fontSize: 22, fontWeight: 700, color: T.amber }}>{fmtMoney(filteredTotal)}</span>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Type", "Product", "Qty", "Price", "Amount", "Customer", "Supplier", "Staff", "Timestamp", ""].map((h) => (
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
                  <td style={{ padding: "10px 16px" }}>
                    <Badge tone={movementTone(t.type)}>{t.type}</Badge>
                    {t.type === "OUT" && t.price_type && (
                      <div style={{ fontSize: 9, color: t.price_type === "market" ? T.amber : T.textFaint, marginTop: 3, ...fontMono, letterSpacing: "0.04em" }}>
                        {t.price_type.toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.text }}>{p ? p.name : "Deleted product"}</td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: T.text }}>{t.qty} {p ? (p.unit || "pcs") : ""}</td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: T.textMuted }}>
                    {fmtMoney(t.price)}
                    {t.market_price != null && (
                      <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>mkt: {fmtMoney(t.market_price)}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 13, color: T.text, fontWeight: 600 }}>{fmtMoney(t.price * t.qty)}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.textMuted }}>{t.customer_name || "\u2014"}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.textMuted }}>{s ? s.name : "\u2014"}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: T.textMuted }}>{t.staff}</td>
                  <td style={{ padding: "10px 16px", ...fontMono, fontSize: 12, color: T.textFaint }}>{fmtDateTime(t.timestamp)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          const p = products.find((pp) => pp.id === t.product_id);
                          const label = `${t.type} ${t.qty} ${p ? p.unit || "pcs" : ""} of "${p ? p.name : "this product"}" on ${fmtDateTime(t.timestamp)}`;
                          if (window.confirm(`Delete this entry?\n\n${label}\n\nThis can't be undone and is recorded in the Void log.`)) {
                            onDeleteOne(t.id);
                          }
                        }}
                        style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: 4, display: "flex" }}
                        title="Delete this entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredTxns.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: T.textFaint, fontSize: 13 }}>No movement recorded.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>

      {isAdmin && (
        <>
          <BarcodeDivider />
          <DangerZoneCard transactions={transactions} onDeleteRange={onDeleteRange} />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   BARCODE CONTROL VIEW
--------------------------------------------------------------- */
/* ---------------------------------------------------------------
   POINT OF SALE — cart checkout with printable receipt
--------------------------------------------------------------- */
function PosView({ products, staffName, onLog, isMobile }) {
  const [cart, setCart] = useState([]); // {productId, name, unit, qty, unitPrice, retailPrice, marketPrice, priceType}
  const [scanCode, setScanCode] = useState("");
  const [scanError, setScanError] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [saleTimestamp, setSaleTimestamp] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [priceMode, setPriceMode] = useState("retail"); // "retail" | "market" — default price for newly scanned items
  const scanInputRef = useRef(null);

  useEffect(() => { scanInputRef.current && scanInputRef.current.focus(); }, []);

  function addToCart(product) {
    setCart((prev) => {
      const idx = prev.findIndex((r) => r.productId === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      const useMarket = priceMode === "market" && product.market_price != null;
      return [...prev, {
        productId: product.id, name: product.name, unit: product.unit || "pcs", qty: 1,
        unitPrice: useMarket ? product.market_price : product.retail_price,
        retailPrice: product.retail_price, marketPrice: product.market_price,
        priceType: useMarket ? "market" : "retail",
      }];
    });
  }

  function setRowPriceType(index, type) {
    setCart((prev) => prev.map((r, idx) => {
      if (idx !== index) return r;
      const price = type === "market" ? (r.marketPrice ?? r.retailPrice) : r.retailPrice;
      return { ...r, priceType: type, unitPrice: price };
    }));
  }

  function handleScanSubmit(e) {
    e.preventDefault();
    const trimmed = scanCode.trim();
    if (!trimmed) return;
    const product = products.find((p) => p.barcode === trimmed);
    if (!product) {
      setScanError(`No product with barcode ${trimmed}`);
      setScanCode("");
      scanInputRef.current && scanInputRef.current.focus();
      return;
    }
    if (product.status !== "active") {
      setScanError(`${product.name} is ${statusLabel(product.status)} and can't be sold right now`);
      setScanCode("");
      scanInputRef.current && scanInputRef.current.focus();
      return;
    }
    setScanError("");
    addToCart(product);
    setScanCode("");
    scanInputRef.current && scanInputRef.current.focus();
  }

  function updateQty(i, qty) {
    setCart((prev) => prev.map((r, idx) => (idx === i ? { ...r, qty: Math.max(0.001, Number(qty) || 0.001) } : r)));
  }
  function updatePrice(i, price) {
    setCart((prev) => prev.map((r, idx) => (idx === i ? { ...r, unitPrice: Math.max(0, Number(price) || 0) } : r)));
  }
  function removeLine(i) {
    setCart((prev) => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = cart.reduce((s, r) => s + r.qty * r.unitPrice, 0);

  async function completeSale() {
    if (cart.length === 0) return;
    setSaving(true);
    const isoTimestamp = saleTimestamp ? new Date(saleTimestamp).toISOString() : new Date().toISOString();
    const remaining = [];
    const soldLines = [];
    for (const row of cart) {
      const ok = await onLog({ productId: row.productId, type: "OUT", qty: row.qty, staff: staffName, price: row.unitPrice, marketPrice: row.marketPrice, priceType: row.priceType, customerName: customerName.trim(), timestamp: isoTimestamp });
      if (ok !== false) soldLines.push(row);
      else remaining.push(row);
    }
    setCart(remaining);
    if (soldLines.length > 0) {
      setReceipt({
        receiptNo: Date.now().toString(36).toUpperCase(),
        timestamp: isoTimestamp,
        staff: staffName,
        customerName: customerName.trim(),
        items: soldLines,
        total: soldLines.reduce((s, r) => s + r.qty * r.unitPrice, 0),
      });
      setSaleTimestamp("");
      setCustomerName("");
      // Reset back to Retail for the next customer \u2014 Market pricing should
      // be a deliberate choice per sale, not something that silently stays
      // switched on after whoever used it last.
      setPriceMode("retail");
    }
    setSaving(false);
    scanInputRef.current && scanInputRef.current.focus();
  }

  function newSale() {
    setReceipt(null);
    setPriceMode("retail");
    scanInputRef.current && scanInputRef.current.focus();
  }

  const pickerResults = pickerQuery.trim()
    ? products.filter((p) => p.status === "active" && p.name.toLowerCase().includes(pickerQuery.toLowerCase())).slice(0, 6)
    : [];

  return (
    <div>
      <SectionHeader eyebrow="Checkout" title="Point of sale" />

      {!receipt && (
        <>
          <Card style={{ marginBottom: 20 }}>
            <Label>Pricing for this customer</Label>
            <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 16, flexWrap: "wrap" }}>
              <Button variant={priceMode === "retail" ? "in" : "ghost"} onClick={() => setPriceMode("retail")}>
                Retail <span style={{ fontWeight: 400, opacity: 0.8 }}>(cafe sales)</span>
              </Button>
              <Button variant={priceMode === "market" ? "amber" : "ghost"} onClick={() => setPriceMode("market")}>
                Market <span style={{ fontWeight: 400, opacity: 0.8 }}>(store buyers)</span>
              </Button>
            </div>
            <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 16 }}>
              {"New items you scan or add use this price by default \u2014 you can still switch any single item, or discount it, once it's in the cart."}
            </div>

            <Label>Scan barcode</Label>
            <form onSubmit={handleScanSubmit} style={{ display: "flex", gap: 10, marginTop: 6, marginBottom: 16, flexWrap: "wrap" }}>
              <Input ref={scanInputRef} value={scanCode} onChange={(e) => { setScanCode(e.target.value); setScanError(""); }} placeholder="e.g. 041982773610" style={{ ...fontMono, maxWidth: 320 }} autoFocus />
              <Button type="submit" variant="amber"><Plus size={14} />Add to cart</Button>
            </form>
            {scanError && <div style={{ color: T.out, fontSize: 12, marginBottom: 12 }}>{scanError}</div>}

            <Label>Or find a product</Label>
            <div style={{ position: "relative", marginTop: 6, maxWidth: 360 }}>
              <Input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Search product name" />
              {pickerResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: T.surfaceRaised, border: `1px solid ${T.borderStrong}`, borderRadius: 4, zIndex: 5, overflow: "hidden" }}>
                  {pickerResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => { addToCart(p); setPickerQuery(""); }}
                      style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, color: T.text, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}
                    >
                      <span>{p.name}</span>
                      <span style={{ ...fontMono, fontSize: 12, color: T.textFaint }}>{fmtMoney(p.retail_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 16, paddingTop: 16 }}>
              <Label>Customer name (optional)</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Vicky Bisquera" style={{ maxWidth: 260 }} />
              <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>
                {"Lets you filter the Movement log by customer later, to see who buys most often."}
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 16, paddingTop: 16 }}>
              <Label>Sale date (defaults to now)</Label>
              <Input type="datetime-local" value={saleTimestamp} onChange={(e) => setSaleTimestamp(e.target.value)} style={{ maxWidth: 220 }} />
              <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>
                {"Set this before completing the sale if you're entering an order from a different day."}
              </div>
            </div>
          </Card>

          <Card style={{ marginBottom: 20 }}>
            <Label>Cart {cart.length > 0 ? `(${cart.length})` : ""}</Label>
            {cart.length === 0 ? (
              <div style={{ color: T.textFaint, fontSize: 13, marginTop: 10 }}>Scan or search to add items.</div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {["Product", "Qty", "Unit price", "Line total", ""].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 10px", ...fontMono, fontSize: 10, letterSpacing: "0.06em", color: T.textFaint, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "8px 10px", fontSize: 13, color: T.text }}>{row.name}<span style={{ color: T.textFaint, fontSize: 11 }}> / {row.unit}</span></td>
                          <td style={{ padding: "8px 10px" }}>
                            <Input type="number" step="any" min="0.001" value={row.qty} onChange={(e) => updateQty(i, e.target.value)} style={{ width: 70, padding: "5px 8px", fontSize: 12 }} />
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <Input type="number" step="0.01" min="0" value={row.unitPrice} onChange={(e) => updatePrice(i, e.target.value)} style={{ width: 90, padding: "5px 8px", fontSize: 12, ...fontMono }} />
                            {row.marketPrice != null && (
                              <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                                <button
                                  onClick={() => setRowPriceType(i, "retail")}
                                  style={{
                                    ...fontMono, fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                                    background: row.priceType === "retail" ? T.inDim : "transparent",
                                    color: row.priceType === "retail" ? T.inText : T.textFaint,
                                    border: `1px solid ${row.priceType === "retail" ? T.in : T.border}`,
                                  }}
                                >
                                  RETAIL
                                </button>
                                <button
                                  onClick={() => setRowPriceType(i, "market")}
                                  style={{
                                    ...fontMono, fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                                    background: row.priceType === "market" ? T.amberDim : "transparent",
                                    color: row.priceType === "market" ? T.amberText : T.textFaint,
                                    border: `1px solid ${row.priceType === "market" ? T.amber : T.border}`,
                                  }}
                                >
                                  MARKET
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", ...fontMono, fontSize: 13, color: T.text }}>{fmtMoney(row.qty * row.unitPrice)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            <button onClick={() => removeLine(i)} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: 4 }}>
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                  <div style={{ textAlign: "right" }}>
                    <Label>Total</Label>
                    <div style={{ ...fontDisplay, fontSize: 26, fontWeight: 700, color: T.text }}>{fmtMoney(subtotal)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <Button variant="in" onClick={completeSale} disabled={saving}>
                    <CheckCircle2 size={14} />{saving ? "Processing\u2026" : "Complete sale"}
                  </Button>
                  <Button variant="ghost" onClick={() => setCart([])} disabled={saving}>
                    <X size={14} />Clear cart
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {receipt && (
        <>
          <Card style={{ marginBottom: 16, borderColor: T.in }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <CheckCircle2 size={16} color={T.in} />
              <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: T.text }}>Sale completed</div>
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{`Receipt #${receipt.receiptNo} \u2014 ${fmtMoney(receipt.total)} total`}</div>
          </Card>

          <div className="print-receipt">
            <Card style={{ marginBottom: 20, maxWidth: 400 }}>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ ...fontDisplay, fontWeight: 700, fontSize: 18, color: T.text }}>STOCKLINE</div>
                <div style={{ ...fontMono, fontSize: 11, color: T.textFaint, marginTop: 2 }}>Sales Receipt</div>
              </div>
              <div style={{ ...fontMono, fontSize: 11, color: T.textMuted, marginBottom: 12 }}>
                <div>Receipt #{receipt.receiptNo}</div>
                <div>{fmtDateTime(receipt.timestamp)}</div>
                <div>Served by {receipt.staff}</div>
                {receipt.customerName && <div>Customer: {receipt.customerName}</div>}
              </div>
              <div style={{ borderTop: `1px dashed ${T.border}`, borderBottom: `1px dashed ${T.border}`, padding: "10px 0", marginBottom: 12 }}>
                {receipt.items.map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.text, marginBottom: 6 }}>
                    <span>{row.name} <span style={{ color: T.textFaint, fontSize: 11 }}>x{row.qty} {row.unit}</span></span>
                    <span style={{ ...fontMono }}>{fmtMoney(row.qty * row.unitPrice)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", ...fontDisplay, fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                <span>Total</span>
                <span>{fmtMoney(receipt.total)}</span>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: T.textFaint, marginTop: 14 }}>Thank you!</div>
            </Card>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="amber" onClick={() => window.print()}><Receipt size={14} />Print receipt</Button>
            <Button variant="in" onClick={newSale}><Plus size={14} />New sale</Button>
          </div>
        </>
      )}
    </div>
  );
}

function BarcodeView({ products, onSetStatus, onLog, staffName, isAdmin, isMobile }) {
  const [code, setCode] = useState("");
  const [match, setMatch] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef(null);

  const [scanMode, setScanMode] = useState("REMOVE"); // ADD | REMOVE | DISCARD
  const [cart, setCart] = useState([]);
  const [scanCode, setScanCode] = useState("");
  const [scanError, setScanError] = useState("");
  const [lastBatch, setLastBatch] = useState(null);
  const [saving, setSaving] = useState(false);
  const scanInputRef = useRef(null);

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

  function handleScanSubmit(e) {
    e.preventDefault();
    const trimmed = scanCode.trim();
    if (!trimmed) return;
    const product = products.find((p) => p.barcode === trimmed);
    if (!product) {
      setScanError(`No product with barcode ${trimmed}`);
      setScanCode("");
      scanInputRef.current && scanInputRef.current.focus();
      return;
    }
    setScanError("");
    setCart((prev) => {
      const idx = prev.findIndex((r) => r.productId === product.id && r.action === scanMode);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { productId: product.id, name: product.name, unit: product.unit || "pcs", barcode: product.barcode, qty: 1, action: scanMode }];
    });
    setScanCode("");
    scanInputRef.current && scanInputRef.current.focus();
  }

  function updateCartQty(index, qty) {
    setCart((prev) => prev.map((r, i) => (i === index ? { ...r, qty: Math.max(0.001, Number(qty) || 0.001) } : r)));
  }
  function updateCartAction(index, action) {
    setCart((prev) => prev.map((r, i) => (i === index ? { ...r, action } : r)));
  }
  function removeCartRow(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function estValue(row) {
    const p = products.find((pp) => pp.id === row.productId);
    if (!p) return 0;
    const unitPrice = row.action === "REMOVE" ? p.retail_price : p.purchase_price;
    return unitPrice * row.qty;
  }

  async function saveBatch() {
    setSaving(true);
    const remaining = [];
    let addedQty = 0, addedValue = 0, removedQty = 0, removedValue = 0, discardedQty = 0, discardedValue = 0;
    for (const row of cart) {
      const type = row.action === "ADD" ? "IN" : row.action === "REMOVE" ? "OUT" : "DISCARD";
      const ok = await onLog({ productId: row.productId, type, qty: row.qty, staff: staffName });
      if (ok !== false) {
        const p = products.find((pp) => pp.id === row.productId);
        const unitPrice = type === "IN" ? p?.purchase_price : type === "OUT" ? p?.retail_price : p?.purchase_price;
        const value = (unitPrice || 0) * row.qty;
        if (type === "IN") { addedQty += row.qty; addedValue += value; }
        if (type === "OUT") { removedQty += row.qty; removedValue += value; }
        if (type === "DISCARD") { discardedQty += row.qty; discardedValue += value; }
      } else {
        remaining.push(row);
      }
    }
    setCart(remaining);
    setLastBatch({
      addedQty, addedValue, removedQty, removedValue, discardedQty, discardedValue,
      failedCount: remaining.length, timestamp: new Date().toISOString(),
    });
    setSaving(false);
    scanInputRef.current && scanInputRef.current.focus();
  }

  const held = products.filter((p) => p.status === "hold");
  const stopped = products.filter((p) => p.status === "stopped");

  const statusActions = {
    active: [{ status: "hold", label: "Put on hold", icon: AlertTriangle, variant: "amber" }, { status: "stopped", label: "Stop this product", icon: Ban, variant: "out" }],
    hold: [{ status: "active", label: "Reactivate", icon: RotateCcw, variant: "in" }, { status: "stopped", label: "Stop this product", icon: Ban, variant: "out" }],
    stopped: [{ status: "active", label: "Reactivate", icon: RotateCcw, variant: "in" }, { status: "hold", label: "Put on hold", icon: AlertTriangle, variant: "amber" }],
  };

  const scanModes = [
    { key: "ADD", label: "Add (stock in)", icon: ArrowDownToLine, variant: "in" },
    { key: "REMOVE", label: "Remove (sale)", icon: ArrowUpFromLine, variant: "out" },
    { key: "DISCARD", label: "Discard / waste", icon: Trash2, variant: "waste" },
  ];

  return (
    <div>
      <SectionHeader eyebrow="Access control" title="Barcode control" />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ ...fontDisplay, fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>Bulk stock scan</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>
          {"Set the mode, then scan items one after another \u2014 each scan adds to the batch below. Scanning the same item again just bumps its quantity. Nothing is saved until you click Save batch."}
        </div>

        <Label>Scanning as</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, marginTop: 6, flexWrap: "wrap" }}>
          {scanModes.map((m) => {
            const Icon = m.icon;
            return (
              <Button key={m.key} variant={scanMode === m.key ? m.variant : "ghost"} onClick={() => setScanMode(m.key)}>
                <Icon size={14} />{m.label}
              </Button>
            );
          })}
        </div>

        <Label>Scan or enter barcode</Label>
        <form onSubmit={handleScanSubmit} style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <Input
            ref={scanInputRef}
            value={scanCode}
            onChange={(e) => { setScanCode(e.target.value); setScanError(""); }}
            placeholder="e.g. 041982773610"
            style={{ ...fontMono, maxWidth: 320 }}
            autoFocus
          />
          <Button type="submit" variant="amber"><Plus size={14} />Add to batch</Button>
        </form>
        {scanError && <div style={{ color: T.out, fontSize: 12, marginTop: 8 }}>{scanError}</div>}

        {cart.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["Product", "Qty", "Action", "Est. value", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", ...fontMono, fontSize: 10, letterSpacing: "0.06em", color: T.textFaint, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cart.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "8px 10px", fontSize: 13, color: T.text }}>{row.name}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <Input type="number" step="any" min="0.001" value={row.qty} onChange={(e) => updateCartQty(i, e.target.value)} style={{ width: 70, padding: "5px 8px", fontSize: 12 }} />
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {scanModes.map((m) => (
                            <button
                              key={m.key}
                              onClick={() => updateCartAction(i, m.key)}
                              style={{
                                ...fontMono, fontSize: 10, padding: "4px 7px", borderRadius: 3, cursor: "pointer",
                                background: row.action === m.key ? T.surfaceRaised : "transparent",
                                color: row.action === m.key ? T.text : T.textFaint,
                                border: `1px solid ${row.action === m.key ? T.borderStrong : T.border}`,
                              }}
                            >
                              {m.key}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", ...fontMono, fontSize: 12, color: T.textMuted }}>{fmtMoney(estValue(row))}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        <button onClick={() => removeCartRow(i)} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: 4 }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="in" onClick={saveBatch} disabled={saving}>
                <CheckCircle2 size={14} />{saving ? "Saving\u2026" : `Save batch (${cart.length})`}
              </Button>
              <Button variant="ghost" onClick={() => setCart([])} disabled={saving}>
                <X size={14} />Clear batch
              </Button>
            </div>
          </div>
        )}

        {lastBatch && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <Label>{`Last batch saved \u2014 ${fmtDateTime(lastBatch.timestamp)}`}</Label>
            <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap", ...fontMono, fontSize: 13 }}>
              <span style={{ color: T.in }}>+{lastBatch.addedQty} added ({fmtMoney(lastBatch.addedValue)})</span>
              <span style={{ color: T.out }}>-{lastBatch.removedQty} removed / sold ({fmtMoney(lastBatch.removedValue)})</span>
              <span style={{ color: T.waste }}>{lastBatch.discardedQty} discarded ({fmtMoney(lastBatch.discardedValue)})</span>
            </div>
            {lastBatch.failedCount > 0 && (
              <div style={{ color: T.out, fontSize: 12, marginTop: 8 }}>
                {`${lastBatch.failedCount} ${lastBatch.failedCount === 1 ? "item" : "items"} couldn't be saved (likely not enough stock) and stayed in the batch above \u2014 fix and try again.`}
              </div>
            )}
          </div>
        )}
      </Card>

      <BarcodeDivider />

      <Card style={{ marginBottom: 20 }}>
        <Label>Look up a single item</Label>
        <form onSubmit={lookup} style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <Input ref={inputRef} value={code} onChange={(e) => { setCode(e.target.value); setNotFound(false); }} placeholder="e.g. 041982773610" style={{ ...fontMono, maxWidth: 320 }} />
          <Button type="submit" variant="amber"><Search size={14} />Look up</Button>
        </form>
        <div style={{ fontSize: 12, color: T.textFaint, marginTop: 8 }}>
          {"Scanning with a USB/Bluetooth barcode scanner works too \u2014 it types the digits and hits enter automatically."}
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

      <div style={{ display: "grid", gridTemplateColumns: gridCols(isMobile, "1fr 1fr"), gap: 16 }}>
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
function VoidLogView({ products, showToast, isMobile }) {
  const [logs, setLogs] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.getVoidLog()
      .then(setLogs)
      .catch((err) => showToast(err.message, "out"));
  }, []);

  const actionMeta = {
    edit: { label: "EDITED", tone: "amber" },
    delete: { label: "DELETED", tone: "out" },
    bulk_delete: { label: "BULK DELETE", tone: "out" },
  };
  const entityLabel = { product: "Product", supplier: "Supplier", transaction: "Movement entry" };

  return (
    <div>
      <SectionHeader eyebrow="Audit trail" title="Void log" />
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        {"Every edit and delete across the app \u2014 products, suppliers, and movement entries \u2014 is recorded here automatically, including what the record looked like right before it was changed or removed. This can't be turned off and nothing here can be edited."}
      </div>

      {logs === null && <div style={{ color: T.textFaint, fontSize: 13 }}>Loading\u2026</div>}
      {logs && logs.length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>No edits or deletes recorded yet.</div>}

      {logs && logs.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Action", "Type", "Summary", "Staff", "When", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", ...fontMono, fontSize: 11, letterSpacing: "0.06em", color: T.textFaint, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((v) => {
                  const meta = actionMeta[v.action] || { label: v.action.toUpperCase(), tone: "default" };
                  const expanded = expandedId === v.id;
                  let before = null;
                  try { before = v.before_data ? JSON.parse(v.before_data) : null; } catch {}
                  return (
                    <React.Fragment key={v.id}>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: "10px 16px" }}><Badge tone={meta.tone}>{meta.label}</Badge></td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: T.textMuted }}>{entityLabel[v.entity_type] || v.entity_type}</td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: T.text }}>{v.summary}</td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: T.textMuted }}>{v.staff}</td>
                        <td style={{ padding: "10px 16px", ...fontMono, fontSize: 12, color: T.textFaint }}>{fmtDateTime(v.timestamp)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right" }}>
                          {before && (
                            <button
                              onClick={() => setExpandedId(expanded ? null : v.id)}
                              style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: 4, display: "flex", marginLeft: "auto" }}
                            >
                              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded && before && (
                        <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td colSpan={6} style={{ padding: "12px 16px", background: T.surfaceInput }}>
                            <div style={{ ...fontMono, fontSize: 11, color: T.textFaint, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Record before this change
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
                              {Object.entries(before).map(([k, val]) => (
                                <div key={k} style={{ fontSize: 12 }}>
                                  <span style={{ color: T.textFaint }}>{k}: </span>
                                  <span style={{ ...fontMono, color: T.text }}>{val === null ? "\u2014" : String(val)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function AgentsView({ currentAgentName, showToast, isMobile }) {
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
            <div style={{ display: "grid", gridTemplateColumns: gridCols(isMobile, "2fr 1fr 1fr"), gap: 12, marginBottom: 14 }}>
              <div>
                <Label>Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jae" />
              </div>
              <div>
                <Label>PIN (min. 4 digits)</Label>
                <Input required type="password" inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder={"\u2022\u2022\u2022\u2022"} />
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
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
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
        </div>
      </Card>
    </div>
  );
}
