import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";

// ── Firebase ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCvwKO5i3sMITThL7Q6OKivKEbe80TYBI8",
  authDomain: "autoledger-eb37f.firebaseapp.com",
  projectId: "autoledger-eb37f",
  storageBucket: "autoledger-eb37f.firebasestorage.app",
  messagingSenderId: "585176880570",
  appId: "1:585176880570:web:82c6f639534f7b9e2d7983",
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#F0F4FF", white: "#FFFFFF", navy: "#1A237E", blue: "#3F51B5",
  blueLight: "#E8EAF6", amber: "#FF6F00", amberLight: "#FFF3E0",
  green: "#00897B", greenLight: "#E0F2F1", red: "#E53935", redLight: "#FFEBEE",
  slate: "#78909C", slateLight: "#ECEFF1", textMid: "#37474F", textMuted: "#78909C",
  border: "#E3E8F0",
};

// ── Vehicle DB ────────────────────────────────────────────────────────────────
const VEHICLE_DB = {
  Acura:{ MDX:["Base","Tech","A-Spec","SH-AWD"],RDX:["Base","Tech","A-Spec","Advance"],TLX:["Base","Tech","Type S"],ILX:["Base","Premium","Tech"] },
  BMW:{ "3 Series":["320i","330i","M340i","330e"],"5 Series":["530i","540i","M550i"],X3:["sDrive30i","xDrive30i","M40i"],X5:["sDrive40i","xDrive40i","M50i"] },
  Buick:{ Enclave:["Preferred","Essence","Premium","Avenir"],Encore:["Preferred","Essence","Sport Touring"],Envision:["Preferred","Essence","Avenir"] },
  Cadillac:{ XT4:["Luxury","Premium Luxury","Sport"],XT5:["Luxury","Premium Luxury","Sport"],Escalade:["Luxury","Premium Luxury","Sport","Platinum"] },
  Chevrolet:{ Silverado:["WT","Custom","LT","RST","LTZ","High Country"],Equinox:["LS","LT","RS","Premier"],Traverse:["LS","LT","RS","Premier","High Country"],Malibu:["LS","LT","RS","Premier"],Colorado:["WT","LT","Z71","Trail Boss"] },
  Chrysler:{ "300":["Touring","S","Limited","Platinum"],Pacifica:["Touring","Touring L","Limited","Pinnacle"] },
  Dodge:{ "Grand Caravan":["SE","SXT","GT"],Durango:["SXT","GT","R/T","Citadel","SRT"],Challenger:["SXT","GT","R/T","Scat Pack","SRT Hellcat"],Charger:["SXT","GT","R/T","Scat Pack","SRT Hellcat"] },
  Ford:{ "F-150":["XL","XLT","Lariat","King Ranch","Platinum","Limited","Raptor"],Explorer:["Base","XLT","ST-Line","Limited","Platinum","ST"],Escape:["S","SE","SE Sport","Titanium"],Edge:["SE","SEL","ST-Line","Titanium","ST"],Expedition:["XLT","Limited","King Ranch","Platinum"],Mustang:["EcoBoost","GT","Mach 1","Shelby GT500"],Ranger:["XL","XLT","Lariat"] },
  GMC:{ Sierra:["Base","SLE","Elevation","SLT","AT4","Denali"],Terrain:["SLE","SLT","AT4","Denali"],Acadia:["SLE","SLT","AT4","Denali"],Yukon:["SLE","SLT","AT4","Denali","XL"] },
  Honda:{ "CR-V":["LX","EX","EX-L","Sport","Touring","Sport Hybrid","Touring Hybrid"],Civic:["LX","Sport","EX","EX-L","Touring","Si","Type R"],Accord:["LX","Sport","EX","EX-L","Touring"],Pilot:["LX","EX","EX-L","TrailSport","Touring","Elite"],Odyssey:["LX","EX","EX-L","Touring","Elite"],Ridgeline:["Sport","RTL","RTL-E","Black Edition"],"HR-V":["LX","EX","EX-L","Sport"] },
  Hyundai:{ Tucson:["Essential","Preferred","Trend","Ultimate","N Line"],"Santa Fe":["Essential","Preferred","Trend","Ultimate","Calligraphy"],Elantra:["Essential","Preferred","Sport","Luxury","N"],Sonata:["Essential","Preferred","Sport","Ultimate"],Kona:["Essential","Preferred","Trend","Ultimate"] },
  Infiniti:{ QX60:["Pure","Luxe","Sensory","Autograph"],QX80:["Luxe","Premium Select","Sensory","Autograph"],Q50:["Pure","Luxe","Sport","Red Sport 400"] },
  Jeep:{ "Grand Cherokee":["Laredo","Altitude","Limited","Trailhawk","Overland","Summit","SRT"],Wrangler:["Sport","Sport S","Sahara","Rubicon","4xe"],Cherokee:["Latitude","Latitude Lux","Limited","Trailhawk","Overland"],Compass:["Sport","North","Altitude","Limited","Trailhawk"] },
  Kia:{ Sorento:["LX","S","EX","SX","SX Prestige"],Sportage:["LX","EX","SX","SX Prestige"],Telluride:["LX","S","EX","SX","X-Line","X-Pro"],Forte:["LX","GT-Line","EX","GT"] },
  Lexus:{ RX:["RX350","RX350L","RX450h","RX500h"],NX:["NX250","NX350","NX350h","NX450h+"],ES:["ES250","ES300h","ES350"],GX:["GX460"],LX:["LX600"] },
  Lincoln:{ Navigator:["Standard","Reserve","Black Label"],Aviator:["Standard","Reserve","Black Label","Grand Touring"],Nautilus:["Standard","Select","Reserve","Black Label"] },
  Mazda:{ "CX-5":["GX","GS","GT","Signature"],"CX-9":["GS","GT","Signature"],Mazda3:["GX","GS","GT","Turbo"],"CX-50":["GX","GS","GT","Turbo"] },
  Mercedes:{ "C-Class":["C300","C43 AMG","C63 AMG"],"E-Class":["E350","E450","E53 AMG"],GLE:["GLE350","GLE450","GLE53","GLE63S"],GLC:["GLC300","GLC43","GLC63"] },
  Mitsubishi:{ Outlander:["ES","SE","SEL","GT","PHEV SE","PHEV SEL"],RVR:["ES","SE","SE Limited","GT"],"Eclipse Cross":["ES","SE","SEL","GT"] },
  Nissan:{ Rogue:["S","SV","SL","Platinum"],Altima:["S","SV","SR","SL","Platinum"],Murano:["S","SV","SL","Platinum"],Pathfinder:["S","SV","SL","Platinum"],Frontier:["S","SV","Pro-4X","SL"],Titan:["S","SV","Pro-4X","SL","Platinum Reserve"] },
  RAM:{ "1500":["Tradesman","Big Horn","Laramie","Rebel","Limited","TRX"],"2500":["Tradesman","Big Horn","Laramie","Power Wagon","Limited"],ProMaster:["1500","2500","3500"] },
  Subaru:{ Forester:["Base","Premium","Sport","Limited","Touring"],Outback:["Base","Premium","Onyx Edition","Limited","Touring","Wilderness"],Crosstrek:["Base","Premium","Sport","Limited"],Impreza:["Base","Premium","Sport","Limited"] },
  Tesla:{ "Model 3":["Standard Range","Long Range","Performance"],"Model Y":["Long Range","Performance"],"Model S":["Long Range","Plaid"],"Model X":["Long Range","Plaid"] },
  Toyota:{ "RAV4":["LE","XLE","XLE Premium","TRD Off-Road","Adventure","Limited","Hybrid LE","Hybrid XSE","Hybrid Limited","Prime SE","Prime XSE"],Camry:["LE","SE","XSE","XLE","TRD","Hybrid LE","Hybrid XSE","Hybrid XLE"],Corolla:["L","LE","SE","XSE","XLE","Hybrid LE"],Highlander:["L","LE","XLE","XSE","Limited","Platinum","Hybrid LE","Hybrid XLE","Hybrid Platinum"],Tacoma:["SR","SR5","TRD Sport","TRD Off-Road","Limited","TRD Pro"],Tundra:["SR","SR5","TRD Sport","TRD Off-Road","Limited","Platinum","TRD Pro"],Sienna:["LE","XLE","XSE","Limited","Platinum"],"4Runner":["SR5","TRD Sport","TRD Off-Road","Limited","TRD Pro"],Venza:["LE","XLE","Limited"] },
  Volkswagen:{ Tiguan:["Trendline","Comfortline","Highline","R-Line"],Jetta:["Trendline","Comfortline","Highline","GLI"],Atlas:["Trendline","Comfortline","Highline","Execline","Cross Sport"] },
  Volvo:{ XC60:["Core","Plus","Ultimate"],XC90:["Core","Plus","Ultimate"],XC40:["Core","Plus","Ultimate","Recharge"] },
};
const MAKES = Object.keys(VEHICLE_DB).sort();
const YEARS = Array.from({ length: 20 }, (_, i) => String(2025 - i));

const EXPENSE_CATEGORIES = {
  Mechanical: ["Battery","Alternator","Starter","Transmission","Engine","Brakes","Suspension","Steering","Oil Change","Exhaust","AC Compressor","Radiator","Catalytic Converter","Timing Belt/Chain"],
  Exterior: ["Front Bumper","Rear Bumper","Front Fender","Rear Fender","Hood","Door","Mirror","Headlight","Tail Light","Windshield","Side Panel","Roof Panel"],
  "Tires & Wheels": ["Tire","Rim","Wheel Bearing","TPMS Sensor","Lug Nuts"],
  Fluids: ["Oil","Coolant","Brake Fluid","Transmission Fluid","Power Steering Fluid","Differential Fluid"],
  Labor: ["Mechanic Labor","Body Shop Labor","Painting","Detailing","Diagnostic"],
  Fees: ["Safety Certificate","Licensing","Registration","Inspection","Storage","Towing","Auction Fee"],
  Other: ["Custom..."],
};

const STATUS_META = {
  "In Repair": { color:"#FF6F00", bg:"#FFF3E0", icon:"🔧" },
  Available:   { color:"#00897B", bg:"#E0F2F1", icon:"✅" },
  Sold:        { color:"#7B1FA2", bg:"#F3E5F5", icon:"🏁" },
};

const CAT_COLORS = {
  Mechanical: { bg:"#E3F2FD", color:"#1565C0" },
  Exterior: { bg:"#FCE4EC", color:"#880E4F" },
  "Tires & Wheels": { bg:"#F3E5F5", color:"#6A1B9A" },
  Fluids: { bg:"#E0F7FA", color:"#006064" },
  Labor: { bg:"#FFF3E0", color:"#E65100" },
  Fees: { bg:"#F1F8E9", color:"#33691E" },
  Other: { bg:"#ECEFF1", color:"#37474F" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-CA", { style:"currency", currency:"CAD", maximumFractionDigits:0 }).format(n || 0);
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

function calcVehicle(v) {
  const totalExpenses = (v.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalCost = Number(v.purchasePrice || 0) + totalExpenses;
  const profit = v.status === "Sold"
    ? Number(v.salePrice || 0) - totalCost
    : Number(v.estimatedSale || 0) - totalCost;
  const margin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  return { totalExpenses, totalCost, profit, margin };
}

function allReceipts(vehicle) {
  const out = [];
  (vehicle.expenses || []).forEach((e) =>
    (e.receipts || []).forEach((r) =>
      out.push({ ...r, expenseItem: e.item, expenseDate: e.date, expenseVendor: e.vendor })
    )
  );
  return out;
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename || "receipt";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    car:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-4h10l2 4h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>,
    plus:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    dollar:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    chart:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    back:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
    camera:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    upload:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
    file:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    check:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    spark:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    trash:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    folder:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    eye:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    x:        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    menu:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  };
  return icons[name] || null;
};

// ── Shared UI tokens ──────────────────────────────────────────────────────────
const S = {
  card: { background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, boxShadow: "0 2px 12px rgba(26,35,126,0.07)", overflow: "hidden" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 6 },
  input: { width: "100%", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "13px 14px", color: C.navy, fontSize: 16, boxSizing: "border-box", outline: "none", fontFamily: "inherit", WebkitAppearance: "none" },
  section: { fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
};

function Btn({ children, onClick, color = C.blue, textColor = C.white, outline = false, full = false, size = "md", disabled = false }) {
  const pad = size === "lg" ? "15px 24px" : size === "sm" ? "8px 14px" : "11px 20px";
  const fs = size === "lg" ? 17 : size === "sm" ? 13 : 15;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background: outline ? "transparent" : color, color: outline ? color : textColor, border: `2px solid ${color}`, padding: pad, borderRadius: 12, fontWeight: 700, fontSize: fs, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: full ? "100%" : "auto", opacity: disabled ? 0.6 : 1, fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", full, children }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : {}}>
      <label style={S.label}>{label}</label>
      {children || <input style={S.input} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

function Select({ label, value, options, onChange, placeholder = "Select..." }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <select style={{ ...S.input, appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2378909C' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36 }} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ProfitRing({ margin, size = 56 }) {
  const r = 22, circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, margin));
  const color = margin < 0 ? C.red : margin < 15 ? C.amber : C.green;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke={C.border} strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${(clamped / 100) * circ} ${circ}`}
          strokeLinecap="round" transform="rotate(-90 28 28)" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color }}>
        {margin.toFixed(0)}%
      </div>
    </div>
  );
}

// ── ROOT APP ─────────────────────────────────────────────────────────────────
export default function AutoLedger() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [view, setView] = useState("dashboard"); // dashboard | list | detail | addVehicle | addExpense | sell | docs
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { dataUrl, name }

  const selected = vehicles.find((v) => v.id === selectedId);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vehicles"),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setVehicles(docs);
        setLoading(false);
      },
      (err) => { console.error(err); setDbError("Cannot connect to Firestore. Check rules."); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const stats = vehicles.reduce((acc, v) => {
    const { totalCost, profit } = calcVehicle(v);
    acc.invested += totalCost;
    if (v.status === "Sold") { acc.profit += profit; acc.sold++; }
    else { acc.inventory += Number(v.estimatedSale || 0); acc.active++; }
    return acc;
  }, { invested: 0, profit: 0, inventory: 0, sold: 0, active: 0 });

  async function addVehicle(data) {
    setSaving(true);
    try { await addDoc(collection(db, "vehicles"), { ...data, expenses: [], status: "In Repair", createdAt: serverTimestamp() }); setView("list"); }
    catch { alert("Save failed. Check Firestore rules."); }
    finally { setSaving(false); }
  }

  async function saveExpense(vehicleId, expense) {
    setSaving(true);
    try {
      const v = vehicles.find((x) => x.id === vehicleId);
      const expenses = [...(v.expenses || []), { ...expense, id: uid() }];
      await updateDoc(doc(db, "vehicles", vehicleId), { expenses });
      setView("detail");
    } catch { alert("Save failed."); }
    finally { setSaving(false); }
  }

  async function deleteExpense(vehicleId, expenseId) {
    const v = vehicles.find((x) => x.id === vehicleId);
    await updateDoc(doc(db, "vehicles", vehicleId), { expenses: (v.expenses || []).filter((e) => e.id !== expenseId) });
  }

  async function markSold(vehicleId, data) {
    setSaving(true);
    try { await updateDoc(doc(db, "vehicles", vehicleId), { status: "Sold", ...data }); setView("detail"); }
    catch { alert("Save failed."); }
    finally { setSaving(false); }
  }

  async function deleteVehicle(vehicleId) {
    if (!window.confirm("Delete this vehicle? This cannot be undone.")) return;
    setSaving(true);
    try { await deleteDoc(doc(db, "vehicles", vehicleId)); setView("list"); }
    catch { alert("Delete failed."); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, gap: 16 }}>
      <div style={{ width: 44, height: 44, border: `4px solid ${C.border}`, borderTop: `4px solid ${C.blue}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: C.textMuted }}>Loading AutoLedger...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{-webkit-tap-highlight-color:transparent}`}</style>
    </div>
  );

  if (dbError) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, gap: 12, padding: 24, textAlign: "center" }}>
      <span style={{ fontSize: 48 }}>⚠️</span>
      <h2 style={{ color: C.red, margin: 0 }}>Firestore Error</h2>
      <p style={{ color: C.textMuted, maxWidth: 360 }}>{dbError}</p>
      <p style={{ color: C.textMuted, fontSize: 13 }}>Firebase Console → Firestore → Rules → set <code>allow read, write: if true</code> → Publish</p>
    </div>
  );

  const navTo = (v, id) => { if (id) setSelectedId(id); setView(v); };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, minHeight: "100vh", color: C.navy, maxWidth: 600, margin: "0 auto" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        body{margin:0;background:#F0F4FF}
        input,select,button{font-family:inherit}
      `}</style>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setLightbox(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480 }}>
            {lightbox.dataUrl?.includes("application/pdf") || lightbox.name?.endsWith(".pdf")
              ? <div style={{ background: C.white, borderRadius: 16, padding: 40, textAlign: "center" }}><Ico name="file" size={56} color={C.amber} /><p style={{ color: C.textMid, marginTop: 12 }}>PDF — {lightbox.name}</p></div>
              : <img src={lightbox.dataUrl} alt="receipt" style={{ width: "100%", borderRadius: 12, objectFit: "contain", maxHeight: "70vh" }} />}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn full color={C.green} onClick={() => downloadDataUrl(lightbox.dataUrl, lightbox.name)}><Ico name="download" size={18} color={C.white} />Download</Btn>
              <Btn full outline color={C.white} textColor={C.white} onClick={() => setLightbox(null)}><Ico name="x" size={18} color={C.white} />Close</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ background: C.navy, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 16px rgba(26,35,126,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {(view !== "dashboard" && view !== "list") && (
              <button onClick={() => view === "addExpense" || view === "sell" || view === "docs" ? navTo("detail") : navTo("list")} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", color: C.white }}>
                <Ico name="back" size={20} color={C.white} />
              </button>
            )}
            <div style={{ background: C.amber, borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: C.white }}>AL</div>
            <span style={{ fontWeight: 800, fontSize: 17, color: C.white }}>AutoLedger</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => navTo("dashboard")} style={{ background: view === "dashboard" ? "rgba(255,255,255,0.2)" : "none", border: "none", color: C.white, cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              <Ico name="chart" size={18} color={C.white} />
            </button>
            <button onClick={() => navTo("list")} style={{ background: ["list","detail","addVehicle","addExpense","sell","docs"].includes(view) ? "rgba(255,255,255,0.2)" : "none", border: "none", color: C.white, cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              <Ico name="car" size={18} color={C.white} />
            </button>
            <button onClick={() => navTo("addVehicle")} style={{ background: C.amber, border: "none", color: C.white, cursor: "pointer", padding: "6px 12px", borderRadius: 8, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <Ico name="plus" size={16} color={C.white} />Add
            </button>
          </div>
        </div>
      </header>

      {/* Saving toast */}
      {saving && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: C.navy, color: C.white, padding: "10px 20px", borderRadius: 24, fontSize: 14, fontWeight: 600, zIndex: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
          Saving...
        </div>
      )}

      <main style={{ padding: "16px 16px 100px" }}>
        {view === "dashboard" && <Dashboard stats={stats} vehicles={vehicles} onSelect={(id) => navTo("detail", id)} />}
        {view === "list" && <VehicleList vehicles={vehicles} onSelect={(id) => navTo("detail", id)} onAdd={() => navTo("addVehicle")} />}
        {view === "detail" && selected && (
          <VehicleDetail vehicle={selected}
            onAddExpense={() => navTo("addExpense")}
            onSell={() => navTo("sell")}
            onDelete={() => deleteVehicle(selected.id)}
            onDeleteExpense={(eid) => deleteExpense(selected.id, eid)}
            onViewDocs={() => navTo("docs")}
            onViewReceipt={setLightbox} />
        )}
        {view === "addVehicle" && <AddVehicleForm onSave={addVehicle} saving={saving} />}
        {view === "addExpense" && selected && (
          <AddExpenseForm vehicle={selected} onSave={(exp) => saveExpense(selected.id, exp)} saving={saving} />
        )}
        {view === "sell" && selected && (
          <SellForm vehicle={selected} onSave={(d) => markSold(selected.id, d)} saving={saving} />
        )}
        {view === "docs" && selected && (
          <DocumentVault vehicle={selected} onViewReceipt={setLightbox} />
        )}
      </main>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 600, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 env(safe-area-inset-bottom)", zIndex: 100 }}>
        {[
          { id: "dashboard", icon: "chart", label: "Dashboard" },
          { id: "list", icon: "car", label: "Vehicles" },
          { id: "addVehicle", icon: "plus", label: "Add", amber: true },
        ].map(({ id, icon, label, amber }) => {
          const active = view === id || (id === "list" && ["detail","addExpense","sell","docs"].includes(view));
          return (
            <button key={id} onClick={() => navTo(id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0" }}>
              <div style={{ background: amber ? C.amber : active ? C.blueLight : "transparent", borderRadius: 12, padding: "6px 18px", transition: "background 0.15s" }}>
                <Ico name={icon} size={22} color={amber ? C.white : active ? C.blue : C.slate} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: amber ? C.amber : active ? C.blue : C.slate }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ stats, vehicles, onSelect }) {
  const avgMargin = vehicles.filter((v) => v.status === "Sold")
    .reduce((s, v) => { const { totalCost, profit } = calcVehicle(v); return s + (totalCost > 0 ? (profit / totalCost) * 100 : 0); }, 0)
    / Math.max(1, stats.sold);

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px", color: C.navy }}>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Inventory", value: fmt(stats.inventory), sub: `${stats.active} active`, accent: C.blue, bg: C.blueLight, icon: "🚗" },
          { label: "Invested", value: fmt(stats.invested), sub: "all vehicles", accent: C.navy, bg: "#EDE7F6", icon: "💰" },
          { label: "Profit", value: fmt(stats.profit), sub: `${stats.sold} sold`, accent: C.green, bg: C.greenLight, icon: "📈" },
          { label: "Avg Margin", value: avgMargin.toFixed(1) + "%", sub: "per sold deal", accent: C.amber, bg: C.amberLight, icon: "🎯" },
        ].map((sc) => (
          <div key={sc.label} style={{ background: sc.bg, borderRadius: 14, padding: "14px 16px", border: `1.5px solid ${sc.accent}22` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: sc.accent, textTransform: "uppercase", letterSpacing: 0.8 }}>{sc.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: sc.accent, margin: "4px 0 2px" }}>{sc.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{sc.sub}</div>
          </div>
        ))}
      </div>

      {vehicles.length === 0 ? (
        <div style={{ ...S.card, padding: "40px 20px", textAlign: "center", color: C.textMuted }}>
          <div style={{ fontSize: 48 }}>🚗</div>
          <p style={{ fontWeight: 600, marginTop: 8 }}>No vehicles yet</p>
          <p style={{ fontSize: 14 }}>Tap + Add to get started</p>
        </div>
      ) : (
        <>
          <p style={S.section}>Recent Vehicles</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vehicles.slice(0, 5).map((v) => <VehicleCard key={v.id} v={v} onSelect={onSelect} />)}
          </div>
        </>
      )}
    </div>
  );
}

function VehicleCard({ v, onSelect }) {
  const { totalCost, profit, margin } = calcVehicle(v);
  const sm = STATUS_META[v.status] || STATUS_META["In Repair"];
  return (
    <div onClick={() => onSelect(v.id)} style={{ ...S.card, padding: 16, cursor: "pointer", animation: "slideUp 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 2 }}>{v.year} {v.make} {v.model}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>{v.trim} · {Number(v.mileage || 0).toLocaleString()} km</div>
          <span style={{ background: sm.bg, color: sm.color, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{sm.icon} {v.status}</span>
        </div>
        <ProfitRing margin={margin} size={56} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Invested</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.textMid }}>{fmt(totalCost)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{v.status === "Sold" ? "Profit" : "Est. Profit"}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: profit >= 0 ? C.green : C.red }}>{fmt(profit)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Vehicle List ──────────────────────────────────────────────────────────────
function VehicleList({ vehicles, onSelect, onAdd }) {
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? vehicles : vehicles.filter((v) => v.status === filter);
  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Vehicles</h1>
        <span style={{ fontSize: 13, color: C.textMuted }}>{vehicles.length} total</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {["All", "In Repair", "Available", "Sold"].map((t) => {
          const sm = STATUS_META[t];
          const active = filter === t;
          return <button key={t} onClick={() => setFilter(t)} style={{ background: active ? (sm ? sm.bg : C.blueLight) : C.white, color: active ? (sm ? sm.color : C.blue) : C.textMuted, border: `1.5px solid ${active ? (sm ? sm.color : C.blue) : C.border}`, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{t}</button>;
        })}
      </div>
      {filtered.length === 0 && (
        <div style={{ ...S.card, padding: 40, textAlign: "center", color: C.textMuted }}>
          <div style={{ fontSize: 44 }}>🚗</div>
          <p style={{ fontWeight: 600 }}>No vehicles here</p>
          <Btn color={C.amber} onClick={onAdd} size="sm"><Ico name="plus" size={16} color={C.white} />Add Vehicle</Btn>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((v) => <VehicleCard key={v.id} v={v} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

// ── Vehicle Detail ────────────────────────────────────────────────────────────
function VehicleDetail({ vehicle: v, onAddExpense, onSell, onDelete, onDeleteExpense, onViewDocs, onViewReceipt }) {
  const { totalExpenses, totalCost, profit, margin } = calcVehicle(v);
  const sm = STATUS_META[v.status] || STATUS_META["In Repair"];
  const receipts = allReceipts(v);

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      {/* Hero */}
      <div style={{ background: C.navy, borderRadius: 16, padding: 20, marginBottom: 14, color: C.white }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>{v.year} {v.make} {v.model}</h1>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{v.trim} · {Number(v.mileage || 0).toLocaleString()} km</div>
            <span style={{ background: sm.bg, color: sm.color, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{sm.icon} {v.status}</span>
          </div>
          <ProfitRing margin={margin} size={60} />
        </div>
        {/* Financials */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, marginTop: 16, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
          {[
            { label: "Invested", value: fmt(totalCost) },
            { label: v.status === "Sold" ? "Sale Price" : "Est. Sale", value: fmt(v.status === "Sold" ? v.salePrice : v.estimatedSale) },
            { label: v.status === "Sold" ? "Profit" : "Est. Profit", value: fmt(profit), color: profit >= 0 ? "#69F0AE" : "#FF5252" },
          ].map((item, i, arr) => (
            <div key={i} style={{ padding: "10px 12px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.7 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: item.color || C.white, marginTop: 3 }}>{item.value}</div>
            </div>
          ))}
        </div>
        {v.vin && <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>VIN: {v.vin}</div>}
      </div>

      {/* Action buttons */}
      {v.status !== "Sold" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <Btn full color={C.blue} onClick={onAddExpense} size="lg"><Ico name="plus" size={20} color={C.white} />Add Expense</Btn>
          <Btn full color={C.green} onClick={onSell} size="lg"><Ico name="dollar" size={20} color={C.white} />Mark Sold</Btn>
        </div>
      )}

      {/* Documents vault shortcut */}
      {receipts.length > 0 && (
        <div onClick={onViewDocs} style={{ ...S.card, padding: "14px 16px", marginBottom: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: C.blueLight, borderRadius: 10, padding: 8 }}><Ico name="folder" size={20} color={C.blue} /></div>
            <div>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Document Vault</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{receipts.length} receipt{receipts.length !== 1 ? "s" : ""} saved</div>
            </div>
          </div>
          <Ico name="back" size={18} color={C.textMuted} style={{ transform: "rotate(180deg)" }} />
        </div>
      )}

      {/* Expenses */}
      <p style={S.section}>Expenses ({(v.expenses || []).length})</p>
      <div style={{ ...S.card, marginBottom: 14 }}>
        {(v.expenses || []).length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center", color: C.textMuted, fontSize: 14 }}>No expenses yet</div>
        )}
        {(v.expenses || []).map((e) => {
          const cc = CAT_COLORS[e.category] || CAT_COLORS.Other;
          return (
            <div key={e.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ background: cc.bg, color: cc.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>{e.category}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{e.item}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{e.vendor || "—"} · {e.date}</div>
                  {e.note && <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", marginTop: 2 }}>{e.note}</div>}
                  {/* Receipt thumbs */}
                  {(e.receipts || []).length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {e.receipts.map((r, i) => (
                        <div key={i} onClick={(ev) => { ev.stopPropagation(); setLightbox && setLightbox({ dataUrl: r.dataUrl, name: r.name }); }} style={{ position: "relative" }}>
                          <div onClick={() => onViewReceipt({ dataUrl: r.dataUrl, name: r.name })} style={{ width: 56, height: 56, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.slateLight, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {r.type === "application/pdf" || r.name?.endsWith(".pdf")
                              ? <div style={{ textAlign: "center" }}><Ico name="file" size={18} color={C.amber} /><div style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</div></div>
                              : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="receipt" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginLeft: 12 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: C.red }}>-{fmt(e.amount)}</span>
                  {v.status !== "Sold" && (
                    <button onClick={() => onDeleteExpense(e.id)} style={{ background: C.redLight, border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}>
                      <Ico name="trash" size={16} color={C.red} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {(v.expenses || []).length > 0 && (
          <div style={{ padding: "12px 16px", background: C.slateLight, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: C.textMuted }}>Total repairs</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.red }}>{fmt(totalExpenses)}</span>
          </div>
        )}
      </div>

      {v.status === "Sold" && (
        <div style={{ background: C.greenLight, border: `1.5px solid ${C.green}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🏁</span>
          <div>
            <div style={{ fontWeight: 700, color: C.green }}>Sold for {fmt(v.salePrice)}</div>
            <div style={{ fontSize: 13, color: C.green }}>{v.soldDate} · Profit: {fmt(profit)}</div>
          </div>
        </div>
      )}

      <Btn full outline color={C.red} onClick={onDelete} size="sm">Delete Vehicle</Btn>
    </div>
  );
}

// ── Document Vault ────────────────────────────────────────────────────────────
function DocumentVault({ vehicle: v, onViewReceipt }) {
  const receipts = allReceipts(v);
  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Document Vault</h1>
      <p style={{ color: C.textMuted, margin: "0 0 16px", fontSize: 14 }}>{v.year} {v.make} {v.model} · {receipts.length} document{receipts.length !== 1 ? "s" : ""}</p>

      {receipts.length === 0 ? (
        <div style={{ ...S.card, padding: 40, textAlign: "center", color: C.textMuted }}>
          <Ico name="folder" size={48} color={C.border} />
          <p style={{ fontWeight: 600, marginTop: 12 }}>No documents yet</p>
          <p style={{ fontSize: 13 }}>Upload receipts when adding expenses — they're permanently saved here for tax purposes.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Btn full color={C.blue} onClick={() => receipts.forEach((r, i) => setTimeout(() => downloadDataUrl(r.dataUrl, r.name || `receipt-${i + 1}`), i * 200))}>
              <Ico name="download" size={18} color={C.white} />Download All ({receipts.length})
            </Btn>
          </div>
          <div style={{ ...S.card }}>
            {receipts.map((r, i) => {
              const isPdf = r.type === "application/pdf" || r.name?.endsWith(".pdf");
              const filename = r.name || `receipt-${i + 1}`;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < receipts.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div onClick={() => onViewReceipt({ dataUrl: r.dataUrl, name: filename })} style={{ width: 56, height: 56, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.slateLight, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isPdf
                      ? <div style={{ textAlign: "center" }}><Ico name="file" size={20} color={C.amber} /><div style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</div></div>
                      : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="receipt" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.expenseItem}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{r.expenseVendor || "—"} · {r.expenseDate}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{isPdf ? "PDF" : "Image"} · {filename}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onViewReceipt({ dataUrl: r.dataUrl, name: filename })} style={{ background: C.blueLight, border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                      <Ico name="eye" size={18} color={C.blue} />
                    </button>
                    <button onClick={() => downloadDataUrl(r.dataUrl, filename)} style={{ background: C.greenLight, border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                      <Ico name="download" size={18} color={C.green} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Add Vehicle Form ──────────────────────────────────────────────────────────
function AddVehicleForm({ onSave, saving }) {
  const [form, setForm] = useState({ year: "", make: "", model: "", trim: "", vin: "", mileage: "", purchaseDate: today(), purchasePrice: "", estimatedSale: "" });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const models = form.make ? Object.keys(VEHICLE_DB[form.make] || {}).sort() : [];
  const trims = (form.make && form.model) ? (VEHICLE_DB[form.make]?.[form.model] || []) : [];

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px" }}>Add Vehicle</h1>
      <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Year" value={form.year} options={YEARS} onChange={(v) => set("year", v)} placeholder="Select year..." />
        <Select label="Make" value={form.make} options={MAKES} onChange={(v) => { set("make", v); set("model", ""); set("trim", ""); }} placeholder="Select make..." />
        <Select label="Model" value={form.model} options={models} onChange={(v) => { set("model", v); set("trim", ""); }} placeholder={form.make ? "Select model..." : "Select make first"} />
        <Select label="Trim" value={form.trim} options={trims} onChange={(v) => set("trim", v)} placeholder={trims.length ? "Select trim..." : "Select model first"} />
        <Field label="VIN (optional)" value={form.vin} onChange={(v) => set("vin", v)} placeholder="1HGCM82633A123456" />
        <Field label="Mileage (km)" value={form.mileage} onChange={(v) => set("mileage", v)} placeholder="142000" type="number" />
        <Field label="Purchase Date" value={form.purchaseDate} onChange={(v) => set("purchaseDate", v)} type="date" />
        <Field label="Purchase Price (CAD)" value={form.purchasePrice} onChange={(v) => set("purchasePrice", v)} placeholder="6800" type="number" />
        <Field label="Estimated Sale Price (CAD)" value={form.estimatedSale} onChange={(v) => set("estimatedSale", v)} placeholder="12500" type="number" />
        <Btn full color={C.blue} size="lg" disabled={saving} onClick={() => {
          if (!form.year || !form.make || !form.model || !form.purchasePrice) { alert("Year, Make, Model and Purchase Price are required."); return; }
          onSave({ ...form, purchasePrice: Number(form.purchasePrice), estimatedSale: Number(form.estimatedSale) || 0 });
        }}>
          {saving ? "Saving..." : <><Ico name="plus" size={20} color={C.white} />Add Vehicle</>}
        </Btn>
      </div>
    </div>
  );
}

// ── Add Expense Form ──────────────────────────────────────────────────────────
function AddExpenseForm({ vehicle, onSave, saving }) {
  const [category, setCategory] = useState("Mechanical");
  const [item, setItem] = useState("Battery");
  const [customItem, setCustomItem] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const cameraRef = useRef();
  const uploadRef = useRef();

  const items = EXPENSE_CATEGORIES[category] || [];
  const isCustom = item === "Custom...";

  // ── Process any file (camera photo, image upload, or PDF) ────────────────
  async function processFile(file) {
    if (!file) return;
    setScanning(true); setScanError(""); setScanResult(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      const isPdf = file.type === "application/pdf";

      // Store receipt immediately
      setReceipts((prev) => [...prev, { dataUrl, name: file.name || (isPdf ? "receipt.pdf" : "receipt.jpg"), type: mediaType }]);

      // AI scan
      const contentBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          messages: [{ role: "user", content: [
            contentBlock,
            { type: "text", text: 'You are scanning an automotive expense receipt for a Canadian vehicle reseller. Extract data and return ONLY valid JSON, nothing else:\n{"vendor":"store or shop name","date":"YYYY-MM-DD or empty","amount":number,"item":"best match from: Battery,Alternator,Starter,Transmission,Engine,Brakes,Suspension,Steering,Oil Change,Front Bumper,Rear Bumper,Front Fender,Rear Fender,Hood,Door,Mirror,Headlight,Tail Light,Windshield,Tire,Rim,Oil,Coolant,Mechanic Labor,Body Shop Labor,Painting,Detailing,Safety Certificate,Licensing,Other","category":"Mechanical|Exterior|Tires & Wheels|Fluids|Labor|Fees|Other","note":"part number, quantity, or key detail"}' }
          ]}]
        }),
      });

      const data = await resp.json();
      if (data.error) throw new Error(data.error.message);
      const text = (data.content || []).map((b) => b.text || "").join("").trim();
      const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(clean);
      setScanResult(parsed);
    } catch (e) {
      setScanError("Could not read receipt — please fill in manually.");
      console.error(e);
    } finally {
      setScanning(false);
    }
  }

  function applyResult() {
    if (!scanResult) return;
    if (scanResult.vendor) setVendor(scanResult.vendor);
    if (scanResult.date) setDate(scanResult.date);
    if (scanResult.amount) setAmount(String(scanResult.amount));
    if (scanResult.note) setNote(scanResult.note);
    if (scanResult.category && EXPENSE_CATEGORIES[scanResult.category]) {
      setCategory(scanResult.category);
      const matchedItem = EXPENSE_CATEGORIES[scanResult.category].find((i) => i === scanResult.item);
      if (matchedItem) setItem(matchedItem);
    }
    setScanResult(null);
  }

  function handleSave() {
    const finalItem = isCustom ? customItem : item;
    if (!finalItem || !amount) { alert("Item and amount are required."); return; }
    onSave({ category, item: finalItem, amount: Number(amount), vendor, date, note, receipts });
  }

  const cc = CAT_COLORS[category] || CAT_COLORS.Other;

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Add Expense</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>{vehicle.year} {vehicle.make} {vehicle.model}</p>

      {/* ── AI Receipt Scanner ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy}, #283593)`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Ico name="spark" size={18} color={C.amber} />
          <span style={{ fontWeight: 800, fontSize: 16, color: C.white }}>AI Receipt Scanner</span>
          <span style={{ background: C.amber, color: C.white, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>SMART</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
          Take a photo or upload a file — AI reads the receipt and fills the form automatically. Files are saved for CRA tax records.
        </p>

        {/* Hidden file inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files[0]) processFile(e.target.files[0]); e.target.value = ""; }}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.heic,.webp,.gif"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files[0]) processFile(e.target.files[0]); e.target.value = ""; }}
        />

        {/* Big tap buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={scanning}
            style={{ background: C.amber, border: "none", borderRadius: 12, padding: "14px 10px", cursor: scanning ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: scanning ? 0.7 : 1 }}>
            <Ico name="camera" size={28} color={C.white} />
            <span style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>Take Photo</span>
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            disabled={scanning}
            style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "14px 10px", cursor: scanning ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: scanning ? 0.7 : 1 }}>
            <Ico name="upload" size={28} color={C.white} />
            <span style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>Upload File</span>
          </button>
        </div>

        {scanning && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <div style={{ width: 18, height: 18, border: "3px solid rgba(255,255,255,0.3)", borderTop: "3px solid #FF6F00", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
            <span style={{ color: C.amber, fontWeight: 600, fontSize: 14 }}>Scanning receipt with AI...</span>
          </div>
        )}

        {scanError && (
          <div style={{ background: "rgba(229,57,53,0.2)", border: "1px solid rgba(229,57,53,0.4)", borderRadius: 10, padding: "10px 14px", marginTop: 12 }}>
            <span style={{ color: "#FF8A80", fontSize: 13 }}>{scanError}</span>
          </div>
        )}

        {scanResult && (
          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 14, marginTop: 12 }}>
            <div style={{ fontWeight: 700, color: C.white, marginBottom: 4, fontSize: 15 }}>
              ✅ Found: {scanResult.item} {scanResult.amount ? `— $${scanResult.amount}` : ""}
            </div>
            {scanResult.vendor && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{scanResult.vendor}{scanResult.date ? ` · ${scanResult.date}` : ""}</div>}
            {scanResult.note && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{scanResult.note}</div>}
            <button onClick={applyResult} style={{ background: C.amber, border: "none", borderRadius: 10, padding: "10px 20px", marginTop: 10, color: C.white, fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%" }}>
              Apply to Form ✓
            </button>
          </div>
        )}

        {/* Receipt previews */}
        {receipts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 }}>
              Attached ({receipts.length}) — will save with expense
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {receipts.map((r, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <div style={{ width: 60, height: 60, borderRadius: 8, border: "2px solid rgba(255,255,255,0.25)", overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {r.type === "application/pdf" || r.name?.endsWith(".pdf")
                      ? <div style={{ textAlign: "center" }}><Ico name="file" size={18} color={C.amber} /><div style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</div></div>
                      : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
                  </div>
                  <button onClick={() => setReceipts((p) => p.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: -6, right: -6, background: C.red, border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <Ico name="x" size={12} color={C.white} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Expense Form ── */}
      <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Category */}
        <div>
          <label style={S.label}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.keys(EXPENSE_CATEGORIES).map((cat) => {
              const cc2 = CAT_COLORS[cat] || CAT_COLORS.Other;
              const active = category === cat;
              return (
                <button key={cat} onClick={() => { setCategory(cat); setItem(EXPENSE_CATEGORIES[cat][0]); }}
                  style={{ background: active ? cc2.bg : C.slateLight, color: active ? cc2.color : C.textMuted, border: `1.5px solid ${active ? cc2.color : C.border}`, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Item */}
        <Select label="Item" value={item} options={items} onChange={setItem} placeholder="Select item..." />
        {isCustom && <Field label="Describe item" value={customItem} onChange={setCustomItem} placeholder="e.g. Door lock actuator" />}

        {/* Details */}
        <Field label="Amount (CAD)" value={amount} onChange={setAmount} placeholder="275" type="number" />
        <Field label="Vendor / Shop" value={vendor} onChange={setVendor} placeholder="Canadian Tire, Napa Auto..." />
        <Field label="Date" value={date} onChange={setDate} type="date" />
        <Field label="Notes (optional)" value={note} onChange={setNote} placeholder="Used part, set of 4, etc." />

        <Btn full color={cc.color} size="lg" disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save Expense"}
        </Btn>
      </div>
    </div>
  );
}

// ── Sell Form ─────────────────────────────────────────────────────────────────
function SellForm({ vehicle, onSave, saving }) {
  const { totalCost } = calcVehicle(vehicle);
  const [salePrice, setSalePrice] = useState(vehicle.estimatedSale || "");
  const [soldDate, setSoldDate] = useState(today());
  const profit = Number(salePrice) - totalCost;
  const margin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px" }}>Mark as Sold</h1>
      <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: C.blueLight, borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, color: C.navy }}>{vehicle.year} {vehicle.make} {vehicle.model}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>Total invested: {fmt(totalCost)}</div>
        </div>
        <Field label="Sale Price (CAD)" value={salePrice} onChange={setSalePrice} placeholder="12500" type="number" />
        <Field label="Sale Date" value={soldDate} onChange={setSoldDate} type="date" />
        {Number(salePrice) > 0 && (
          <div style={{ background: profit >= 0 ? C.greenLight : C.redLight, border: `1.5px solid ${profit >= 0 ? C.green : C.red}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <ProfitRing margin={margin} size={56} />
            <div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Net Profit</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: profit >= 0 ? C.green : C.red }}>{fmt(profit)}</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{margin.toFixed(1)}% margin</div>
            </div>
          </div>
        )}
        <Btn full color={C.green} size="lg" disabled={saving} onClick={() => {
          if (!salePrice) { alert("Enter a sale price."); return; }
          onSave({ salePrice: Number(salePrice), soldDate });
        }}>
          {saving ? "Saving..." : <><Ico name="check" size={20} color={C.white} />Confirm Sale</>}
        </Btn>
      </div>
    </div>
  );
}
