import { useState, useRef } from "react";

// ─────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────
const C = {
  bg: "#F0F4FF",
  surface: "#FFFFFF",
  navy: "#1A237E",
  blue: "#3F51B5",
  blueLight: "#E8EAF6",
  amber: "#FF6F00",
  amberLight: "#FFF3E0",
  green: "#00897B",
  greenLight: "#E0F2F1",
  red: "#E53935",
  redLight: "#FFEBEE",
  purple: "#7B1FA2",
  purpleLight: "#F3E5F5",
  slate: "#78909C",
  slateLight: "#ECEFF1",
  textMid: "#37474F",
  textMuted: "#78909C",
  border: "#E3E8F0",
  white: "#FFFFFF",
};

// ─────────────────────────────────────────────
// VEHICLE DATABASE
// ─────────────────────────────────────────────
const VEHICLE_DB = {
  Acura: { MDX: ["Base","Tech","A-Spec","SH-AWD"], RDX: ["Base","Tech","A-Spec","Advance"], TLX: ["Base","Tech","Type S"], ILX: ["Base","Premium","Tech"] },
  BMW: { "3 Series": ["320i","330i","M340i","330e"], "5 Series": ["530i","540i","M550i"], X3: ["sDrive30i","xDrive30i","M40i"], X5: ["sDrive40i","xDrive40i","M50i"] },
  Buick: { Enclave: ["Preferred","Essence","Premium","Avenir"], Encore: ["Preferred","Essence","Sport Touring"], Envision: ["Preferred","Essence","Avenir"] },
  Cadillac: { XT4: ["Luxury","Premium Luxury","Sport"], XT5: ["Luxury","Premium Luxury","Sport"], Escalade: ["Luxury","Premium Luxury","Sport","Platinum"] },
  Chevrolet: { Silverado: ["WT","Custom","LT","RST","LTZ","High Country"], Equinox: ["LS","LT","RS","Premier"], Traverse: ["LS","LT","RS","Premier","High Country"], Malibu: ["LS","LT","RS","Premier"], Colorado: ["WT","LT","Z71","Trail Boss"] },
  Chrysler: { "300": ["Touring","S","Limited","Platinum"], Pacifica: ["Touring","Touring L","Limited","Pinnacle"] },
  Dodge: { "Grand Caravan": ["SE","SXT","GT"], Durango: ["SXT","GT","R/T","Citadel","SRT"], Challenger: ["SXT","GT","R/T","Scat Pack","SRT Hellcat"], Charger: ["SXT","GT","R/T","Scat Pack","SRT Hellcat"] },
  Ford: { "F-150": ["XL","XLT","Lariat","King Ranch","Platinum","Limited","Raptor"], Explorer: ["Base","XLT","ST-Line","Limited","Platinum","ST"], Escape: ["S","SE","SE Sport","Titanium"], Edge: ["SE","SEL","ST-Line","Titanium","ST"], Expedition: ["XLT","Limited","King Ranch","Platinum"], Mustang: ["EcoBoost","GT","Mach 1","Shelby GT500"], Ranger: ["XL","XLT","Lariat"] },
  GMC: { Sierra: ["Base","SLE","Elevation","SLT","AT4","Denali"], Terrain: ["SLE","SLT","AT4","Denali"], Acadia: ["SLE","SLT","AT4","Denali"], Yukon: ["SLE","SLT","AT4","Denali","XL"] },
  Honda: { "CR-V": ["LX","EX","EX-L","Sport","Touring","Sport Hybrid","Touring Hybrid"], Civic: ["LX","Sport","EX","EX-L","Touring","Si","Type R"], Accord: ["LX","Sport","EX","EX-L","Touring"], Pilot: ["LX","EX","EX-L","TrailSport","Touring","Elite"], Odyssey: ["LX","EX","EX-L","Touring","Elite"], Ridgeline: ["Sport","RTL","RTL-E","Black Edition"], "HR-V": ["LX","EX","EX-L","Sport"] },
  Hyundai: { Tucson: ["Essential","Preferred","Trend","Ultimate","N Line"], "Santa Fe": ["Essential","Preferred","Trend","Ultimate","Calligraphy"], Elantra: ["Essential","Preferred","Sport","Luxury","N"], Sonata: ["Essential","Preferred","Sport","Ultimate"], Kona: ["Essential","Preferred","Trend","Ultimate"] },
  Infiniti: { QX60: ["Pure","Luxe","Sensory","Autograph"], QX80: ["Luxe","Premium Select","Sensory","Autograph"], Q50: ["Pure","Luxe","Sport","Red Sport 400"] },
  Jeep: { "Grand Cherokee": ["Laredo","Altitude","Limited","Trailhawk","Overland","Summit","SRT"], Wrangler: ["Sport","Sport S","Sahara","Rubicon","4xe"], Cherokee: ["Latitude","Latitude Lux","Limited","Trailhawk","Overland"], Compass: ["Sport","North","Altitude","Limited","Trailhawk"] },
  Kia: { Sorento: ["LX","S","EX","SX","SX Prestige"], Sportage: ["LX","EX","SX","SX Prestige"], Telluride: ["LX","S","EX","SX","X-Line","X-Pro"], Forte: ["LX","GT-Line","EX","GT"] },
  Lexus: { RX: ["RX350","RX350L","RX450h","RX500h"], NX: ["NX250","NX350","NX350h","NX450h+"], ES: ["ES250","ES300h","ES350"], GX: ["GX460"], LX: ["LX600"] },
  Lincoln: { Navigator: ["Standard","Reserve","Black Label"], Aviator: ["Standard","Reserve","Black Label","Grand Touring"], Nautilus: ["Standard","Select","Reserve","Black Label"] },
  Mazda: { "CX-5": ["GX","GS","GT","Signature"], "CX-9": ["GS","GT","Signature"], Mazda3: ["GX","GS","GT","Turbo"], "CX-50": ["GX","GS","GT","Turbo"] },
  Mercedes: { "C-Class": ["C300","C43 AMG","C63 AMG"], "E-Class": ["E350","E450","E53 AMG"], GLE: ["GLE350","GLE450","GLE53","GLE63S"], GLC: ["GLC300","GLC43","GLC63"] },
  Mitsubishi: { Outlander: ["ES","SE","SEL","GT","PHEV SE","PHEV SEL"], RVR: ["ES","SE","SE Limited","GT"], "Eclipse Cross": ["ES","SE","SEL","GT"] },
  Nissan: { Rogue: ["S","SV","SL","Platinum"], Altima: ["S","SV","SR","SL","Platinum"], Murano: ["S","SV","SL","Platinum"], Pathfinder: ["S","SV","SL","Platinum"], Frontier: ["S","SV","Pro-4X","SL"], Titan: ["S","SV","Pro-4X","SL","Platinum Reserve"] },
  RAM: { "1500": ["Tradesman","Big Horn","Laramie","Rebel","Limited","TRX"], "2500": ["Tradesman","Big Horn","Laramie","Power Wagon","Limited"], ProMaster: ["1500","2500","3500"] },
  Subaru: { Forester: ["Base","Premium","Sport","Limited","Touring"], Outback: ["Base","Premium","Onyx Edition","Limited","Touring","Wilderness"], Crosstrek: ["Base","Premium","Sport","Limited"], Impreza: ["Base","Premium","Sport","Limited"] },
  Tesla: { "Model 3": ["Standard Range","Long Range","Performance"], "Model Y": ["Long Range","Performance"], "Model S": ["Long Range","Plaid"], "Model X": ["Long Range","Plaid"] },
  Toyota: { "RAV4": ["LE","XLE","XLE Premium","TRD Off-Road","Adventure","Limited","Hybrid LE","Hybrid XSE","Hybrid Limited","Prime SE","Prime XSE"], Camry: ["LE","SE","XSE","XLE","TRD","Hybrid LE","Hybrid XSE","Hybrid XLE"], Corolla: ["L","LE","SE","XSE","XLE","Hybrid LE"], Highlander: ["L","LE","XLE","XSE","Limited","Platinum","Hybrid LE","Hybrid XLE","Hybrid Platinum"], Tacoma: ["SR","SR5","TRD Sport","TRD Off-Road","Limited","TRD Pro"], Tundra: ["SR","SR5","TRD Sport","TRD Off-Road","Limited","Platinum","TRD Pro"], Sienna: ["LE","XLE","XSE","Limited","Platinum"], "4Runner": ["SR5","TRD Sport","TRD Off-Road","Limited","TRD Pro"], Venza: ["LE","XLE","Limited"] },
  Volkswagen: { Tiguan: ["Trendline","Comfortline","Highline","R-Line"], Jetta: ["Trendline","Comfortline","Highline","GLI"], Atlas: ["Trendline","Comfortline","Highline","Execline","Cross Sport"] },
  Volvo: { XC60: ["Core","Plus","Ultimate"], XC90: ["Core","Plus","Ultimate"], XC40: ["Core","Plus","Ultimate","Recharge"] },
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
  "In Repair": { color: "#FF6F00", bg: "#FFF3E0", label: "In Repair", icon: "🔧" },
  Available:   { color: "#00897B", bg: "#E0F2F1", label: "Available",  icon: "✅" },
  Sold:        { color: "#7B1FA2", bg: "#F3E5F5", label: "Sold",       icon: "🏁" },
};

const CAT_COLORS = {
  Mechanical:      { bg: "#E3F2FD", color: "#1565C0" },
  Exterior:        { bg: "#FCE4EC", color: "#880E4F" },
  "Tires & Wheels":{ bg: "#F3E5F5", color: "#6A1B9A" },
  Fluids:          { bg: "#E0F7FA", color: "#006064" },
  Labor:           { bg: "#FFF3E0", color: "#E65100" },
  Fees:            { bg: "#F1F8E9", color: "#33691E" },
  Other:           { bg: "#ECEFF1", color: "#37474F" },
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);

const pct = (p, c) => (c > 0 ? ((p / c) * 100).toFixed(1) + "%" : "-");
const uid = () => Math.random().toString(36).slice(2, 9);

function calcVehicle(v) {
  const totalExpenses = (v.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalCost = Number(v.purchasePrice || 0) + totalExpenses;
  const profit =
    v.status === "Sold"
      ? Number(v.salePrice || 0) - totalCost
      : Number(v.estimatedSale || 0) - totalCost;
  const margin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  return { totalExpenses, totalCost, profit, margin };
}

// Collect every receipt across all expenses for a vehicle
function allReceipts(vehicle) {
  const result = [];
  (vehicle.expenses || []).forEach((e) => {
    (e.receipts || []).forEach((r) => {
      result.push({ ...r, expenseItem: e.item, expenseDate: e.date, expenseVendor: e.vendor });
    });
  });
  return result;
}

// Trigger a browser download from a data URL
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────
const SEED = [
  {
    id: uid(), year: "2018", make: "Honda", model: "CR-V", trim: "EX",
    vin: "2HKRW2H50JH123456", mileage: "142000", purchaseDate: "2026-05-10",
    purchasePrice: 6800, status: "In Repair", estimatedSale: 12500,
    expenses: [
      { id: uid(), category: "Mechanical", item: "Brakes", amount: 320, vendor: "Midas Hamilton", date: "2026-05-14", note: "", receipts: [] },
      { id: uid(), category: "Exterior", item: "Front Bumper", amount: 275, vendor: "LKQ Ontario", date: "2026-05-18", note: "Used OEM part", receipts: [] },
      { id: uid(), category: "Fees", item: "Safety Certificate", amount: 110, vendor: "Speedy Auto", date: "2026-05-20", note: "", receipts: [] },
    ],
  },
  {
    id: uid(), year: "2019", make: "Toyota", model: "RAV4", trim: "LE",
    vin: "2T3BFREV1KW123789", mileage: "98000", purchaseDate: "2026-04-02",
    purchasePrice: 8200, status: "Sold", salePrice: 15900, soldDate: "2026-05-28",
    expenses: [
      { id: uid(), category: "Mechanical", item: "Alternator", amount: 420, vendor: "Napa Auto", date: "2026-04-10", note: "", receipts: [] },
      { id: uid(), category: "Labor", item: "Detailing", amount: 180, vendor: "Shine & Go", date: "2026-04-22", note: "", receipts: [] },
    ],
  },
  {
    id: uid(), year: "2016", make: "Ford", model: "F-150", trim: "XLT",
    vin: "1FTEW1EG0GFA12345", mileage: "187000", purchaseDate: "2026-06-01",
    purchasePrice: 5500, status: "Available", estimatedSale: 10800,
    expenses: [
      { id: uid(), category: "Mechanical", item: "Battery", amount: 150, vendor: "Canadian Tire", date: "2026-06-05", note: "", receipts: [] },
      { id: uid(), category: "Tires & Wheels", item: "Tire", amount: 640, vendor: "Costco Tire", date: "2026-06-08", note: "Set of 4", receipts: [] },
    ],
  },
];

// ─────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────
const Ico = ({ name, size = 18, color = "currentColor" }) => {
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
  };
  return icons[name] || null;
};

// ─────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────
function ProfitRing({ margin, size = 56 }) {
  const r = 22, circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, margin));
  const color = margin < 0 ? C.red : margin < 15 ? C.amber : C.green;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke={C.border} strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${(clamped / 100) * circ} ${circ}`}
          strokeLinecap="round" transform="rotate(-90 28 28)" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color }}>
        {margin.toFixed(0)}%
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color }) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: C.border, borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: p + "%", background: color, borderRadius: 99, transition: "width 0.4s" }} />
    </div>
  );
}

const btnStyle = (bg = C.blue, fg = C.white) => ({
  background: bg, color: fg, border: "none", padding: "10px 20px",
  borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
});

const card = {
  background: C.white, borderRadius: 14, padding: "22px 24px",
  border: `1.5px solid ${C.border}`, boxShadow: "0 2px 8px rgba(26,35,126,0.05)",
};

const lbl = {
  display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted,
  textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6,
};

const inp = {
  width: "100%", background: C.bg, border: `1.5px solid ${C.border}`,
  borderRadius: 8, padding: "10px 12px", color: C.navy, fontSize: 15,
  boxSizing: "border-box", outline: "none", fontFamily: "inherit",
};

const backBtn = (onClick) => (
  <button onClick={onClick} style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, marginBottom: 20, padding: 0 }}>
    <Ico name="back" size={18} color={C.blue} /> Back to vehicles
  </button>
);

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function AutoLedger() {
  const [vehicles, setVehicles] = useState(SEED);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [lightbox, setLightbox] = useState(null); // { src, name }
  const cameraRef = useRef();
  const uploadRef = useRef();

  const selected = vehicles.find((v) => v.id === selectedId);

  const stats = vehicles.reduce(
    (acc, v) => {
      const { totalCost, profit } = calcVehicle(v);
      acc.totalInvested += totalCost;
      if (v.status === "Sold") { acc.totalProfit += profit; acc.sold++; }
      else { acc.inventoryValue += Number(v.estimatedSale || 0); acc.available++; }
      return acc;
    },
    { totalInvested: 0, totalProfit: 0, inventoryValue: 0, sold: 0, available: 0 }
  );

  const addVehicle = (data) => {
    setVehicles((p) => [...p, { ...data, id: uid(), expenses: [], status: "In Repair" }]);
    setView("list");
  };

  const addExpense = (vehicleId, expense) => {
    setVehicles((p) => p.map((v) => v.id === vehicleId
      ? { ...v, expenses: [...v.expenses, { ...expense, id: uid() }] } : v));
    setPendingReceipts([]);
    setView("detail");
  };

  const deleteExpense = (vehicleId, expenseId) => {
    setVehicles((p) => p.map((v) => v.id === vehicleId
      ? { ...v, expenses: v.expenses.filter((e) => e.id !== expenseId) } : v));
  };

  const sellVehicle = (vehicleId, saleData) => {
    setVehicles((p) => p.map((v) => v.id === vehicleId ? { ...v, status: "Sold", ...saleData } : v));
    setView("detail");
  };

  const deleteVehicle = (vehicleId) => {
    setVehicles((p) => p.filter((v) => v.id !== vehicleId));
    setView("list");
  };

  const handleScan = async (file) => {
    setScanLoading(true); setScanError(null); setScanResult(null);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const dataUrl = "data:" + (file.type || "image/jpeg") + ";base64," + base64;
      setPendingReceipts((p) => [...p, { name: file.name || "receipt", dataUrl, type: file.type || "image/jpeg" }]);
      const isPdf = file.type === "application/pdf";
      const contentBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } };
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content: [
            contentBlock,
            { type: "text", text: 'Extract receipt data. Return ONLY a JSON object, no markdown:\n{"vendor":"store name","date":"YYYY-MM-DD or empty","amount":number,"item":"best match: Battery,Alternator,Starter,Transmission,Engine,Brakes,Suspension,Steering,Oil Change,Front Bumper,Rear Bumper,Front Fender,Rear Fender,Hood,Door,Mirror,Headlight,Tail Light,Windshield,Tire,Rim,Oil,Coolant,Mechanic Labor,Body Shop Labor,Painting,Detailing,Safety Certificate,Licensing,Other","category":"Mechanical|Exterior|Tires & Wheels|Fluids|Labor|Fees|Other","note":"key details"}' }
          ]}],
        }),
      });
      const data = await resp.json();
      const text = data.content?.map((b) => b.text || "").join("") || "";
      setScanResult(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch {
      setScanError("Could not read this file. Try a clearer image or enter manually.");
    } finally {
      setScanLoading(false);
    }
  };

  const isVehicleView = ["list","detail","addVehicle","addExpense","sell"].includes(view);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, minHeight: "100vh", color: C.navy }}>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,35,126,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}
          onClick={() => setLightbox(null)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 24, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>{lightbox.name}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => downloadDataUrl(lightbox.src, lightbox.name)} style={{ ...btnStyle(C.green), fontSize: 13, padding: "7px 14px" }}>
                  <Ico name="download" size={15} color={C.white} /> Download
                </button>
                <button onClick={() => setLightbox(null)} style={{ ...btnStyle(C.navy), fontSize: 13, padding: "7px 14px" }}>Close</button>
              </div>
            </div>
            {lightbox.src.includes("application/pdf")
              ? <div style={{ textAlign: "center", padding: "40px 20px", color: C.textMid }}>
                  <Ico name="file" size={56} color={C.amber} />
                  <p style={{ marginTop: 12, fontWeight: 600 }}>PDF document stored</p>
                  <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Click Download to save to your device.</p>
                  <button onClick={() => downloadDataUrl(lightbox.src, lightbox.name)} style={{ ...btnStyle(C.green), marginTop: 16, fontSize: 14 }}>
                    <Ico name="download" size={16} color={C.white} /> Download PDF
                  </button>
                </div>
              : <img src={lightbox.src} style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: 8, objectFit: "contain" }} />
            }
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header style={{ background: C.navy, boxShadow: "0 2px 12px rgba(26,35,126,0.18)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: C.amber, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: C.white }}>AL</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: C.white, letterSpacing: -0.5 }}>AutoLedger</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[
              { id: "dashboard", icon: "chart", label: "Dashboard" },
              { id: "list",      icon: "car",   label: "Vehicles"  },
            ].map(({ id, icon, label }) => {
              const active = view === id || (isVehicleView && id === "list" && view !== "dashboard");
              return (
                <button key={id} onClick={() => setView(id)} style={{ background: active ? "rgba(255,255,255,0.15)" : "none", border: "none", color: active ? C.white : "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 14, fontWeight: active ? 600 : 400 }}>
                  <Ico name={icon} size={15} color={active ? C.white : "rgba(255,255,255,0.6)"} />{label}
                </button>
              );
            })}
            <button onClick={() => setView("addVehicle")} style={{ ...btnStyle(C.amber), marginLeft: 8, padding: "7px 16px", fontSize: 14 }}>
              <Ico name="plus" size={15} color={C.white} /> Add Vehicle
            </button>
          </nav>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
        {view === "dashboard" && (
          <Dashboard stats={stats} vehicles={vehicles}
            onSelect={(id) => { setSelectedId(id); setView("detail"); }} />
        )}
        {view === "list" && (
          <VehicleList vehicles={vehicles}
            onSelect={(id) => { setSelectedId(id); setView("detail"); }}
            onAdd={() => setView("addVehicle")} />
        )}
        {view === "detail" && selected && (
          <VehicleDetail
            vehicle={selected}
            onBack={() => setView("list")}
            onAddExpense={() => { setScanResult(null); setPendingReceipts([]); setView("addExpense"); }}
            onSell={() => setView("sell")}
            onDelete={() => deleteVehicle(selected.id)}
            onDeleteExpense={(eid) => deleteExpense(selected.id, eid)}
            onViewReceipt={(src, name) => setLightbox({ src, name })}
          />
        )}
        {view === "addVehicle" && (
          <AddVehicleForm onSave={addVehicle} onCancel={() => setView("list")} />
        )}
        {view === "addExpense" && selected && (
          <AddExpenseForm
            vehicle={selected}
            onSave={(exp) => addExpense(selected.id, exp)}
            onCancel={() => { setPendingReceipts([]); setView("detail"); }}
            scanResult={scanResult} setScanResult={setScanResult}
            scanLoading={scanLoading} scanError={scanError}
            pendingReceipts={pendingReceipts} setPendingReceipts={setPendingReceipts}
            onScan={handleScan} cameraRef={cameraRef} uploadRef={uploadRef}
          />
        )}
        {view === "sell" && selected && (
          <SellForm vehicle={selected}
            onSave={(d) => sellVehicle(selected.id, d)}
            onCancel={() => setView("detail")} />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function Dashboard({ stats, vehicles, onSelect }) {
  const avgMargin = vehicles
    .filter((v) => v.status === "Sold")
    .reduce((s, v) => { const { totalCost, profit } = calcVehicle(v); return s + (totalCost > 0 ? (profit / totalCost) * 100 : 0); }, 0)
    / Math.max(1, stats.sold);

  const recent = [...vehicles]
    .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
    .slice(0, 6);

  const cards = [
    { label: "Inventory Value", value: fmt(stats.inventoryValue), sub: `${stats.available} active`,  icon: "🚗", accent: C.blue,   bg: C.blueLight },
    { label: "Total Invested",  value: fmt(stats.totalInvested),  sub: "All vehicles",               icon: "💰", accent: C.navy,   bg: "#EDE7F6" },
    { label: "Realized Profit", value: fmt(stats.totalProfit),    sub: `${stats.sold} sold`,          icon: "📈", accent: C.green,  bg: C.greenLight, positive: true },
    { label: "Avg Margin",      value: avgMargin.toFixed(1) + "%", sub: "Per sold vehicle",           icon: "🎯", accent: C.amber,  bg: C.amberLight },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px", color: C.navy, letterSpacing: -0.5 }}>Dashboard</h1>
        <p style={{ color: C.textMuted, margin: 0, fontSize: 14 }}>Your vehicle business at a glance</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 32 }}>
        {cards.map((sc) => (
          <div key={sc.label} style={{ background: sc.bg, borderRadius: 14, padding: "18px 20px", border: `1.5px solid ${sc.accent}22` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: sc.accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{sc.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: sc.positive ? C.green : sc.accent, letterSpacing: -0.5 }}>{sc.value}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sc.sub}</div>
              </div>
              <span style={{ fontSize: 28 }}>{sc.icon}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: C.navy }}>Recent Vehicles</h2>
        <span style={{ fontSize: 13, color: C.textMuted }}>{vehicles.length} total</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {recent.map((v) => <VehicleCard key={v.id} v={v} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

function VehicleCard({ v, onSelect }) {
  const { totalCost, profit, margin } = calcVehicle(v);
  const sm = STATUS_META[v.status];
  return (
    <div onClick={() => onSelect(v.id)} style={{ background: C.white, borderRadius: 14, padding: 18, cursor: "pointer", border: `1.5px solid ${C.border}`, boxShadow: "0 2px 8px rgba(26,35,126,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>{v.year} {v.make} {v.model}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{v.trim} &middot; {Number(v.mileage || 0).toLocaleString()} km</div>
        </div>
        <ProfitRing margin={margin} size={52} />
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, marginBottom: 12 }}>
        {sm.icon} {sm.label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <div><div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Invested</div><div style={{ fontSize: 16, fontWeight: 700, color: C.textMid }}>{fmt(totalCost)}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{v.status === "Sold" ? "Profit" : "Est. Profit"}</div><div style={{ fontSize: 16, fontWeight: 700, color: profit >= 0 ? C.green : C.red }}>{fmt(profit)}</div></div>
      </div>
      <ProgressBar value={profit >= 0 ? profit : 0} max={totalCost * 0.5} color={profit >= 0 ? C.green : C.red} />
    </div>
  );
}

// ─────────────────────────────────────────────
// VEHICLE LIST
// ─────────────────────────────────────────────
function VehicleList({ vehicles, onSelect, onAdd }) {
  const [filter, setFilter] = useState("All");
  const tabs = ["All", "In Repair", "Available", "Sold"];
  const filtered = filter === "All" ? vehicles : vehicles.filter((v) => v.status === filter);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 2px", color: C.navy }}>Vehicles</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>{vehicles.length} vehicles tracked</p>
        </div>
        <button onClick={onAdd} style={btnStyle(C.amber)}><Ico name="plus" size={16} color={C.white} />Add Vehicle</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const sm = STATUS_META[t];
          const active = filter === t;
          return (
            <button key={t} onClick={() => setFilter(t)} style={{ background: active ? (sm ? sm.bg : C.blueLight) : C.white, color: active ? (sm ? sm.color : C.blue) : C.textMuted, border: `1.5px solid ${active ? (sm ? sm.color : C.blue) : C.border}`, padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t}</button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.textMuted }}>
          <div style={{ fontSize: 48 }}>🚗</div>
          <p style={{ marginTop: 12 }}>No vehicles here yet.</p>
          <button onClick={onAdd} style={{ ...btnStyle(C.amber), marginTop: 12 }}>Add your first vehicle</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {filtered.map((v) => <VehicleCard key={v.id} v={v} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// VEHICLE DETAIL  (with Documents tab)
// ─────────────────────────────────────────────
function VehicleDetail({ vehicle: v, onBack, onAddExpense, onSell, onDelete, onDeleteExpense, onViewReceipt }) {
  const { totalExpenses, totalCost, profit, margin } = calcVehicle(v);
  const [tab, setTab] = useState("expenses");   // "expenses" | "documents"
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sm = STATUS_META[v.status];
  const receipts = allReceipts(v);

  return (
    <div>
      {backBtn(onBack)}

      {/* Hero */}
      <div style={{ background: C.navy, borderRadius: 16, padding: "24px 28px", marginBottom: 20, color: C.white }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.5 }}>{v.year} {v.make} {v.model} {v.trim}</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>VIN: {v.vin || "-"} &middot; {Number(v.mileage || 0).toLocaleString()} km &middot; Purchased {v.purchaseDate}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ProfitRing margin={margin} size={60} />
            <span style={{ background: sm.bg, color: sm.color, fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20 }}>{sm.icon} {sm.label}</span>
          </div>
        </div>
        {/* Financial strip */}
        <div style={{ display: "flex", flexWrap: "wrap", marginTop: 20, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
          {[
            { label: "Purchase Price", value: fmt(v.purchasePrice) },
            { label: "Repair Costs",   value: fmt(totalExpenses) },
            { label: "Total Invested", value: fmt(totalCost),  bold: true },
            { label: v.status === "Sold" ? "Sale Price" : "Est. Sale", value: fmt(v.status === "Sold" ? v.salePrice : v.estimatedSale) },
            { label: v.status === "Sold" ? "Profit" : "Est. Profit", value: fmt(profit), bold: true, color: profit >= 0 ? "#69F0AE" : "#FF5252" },
          ].map((item, i, arr) => (
            <div key={i} style={{ flex: 1, minWidth: 110, padding: "12px 16px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 17, fontWeight: item.bold ? 800 : 500, color: item.color || C.white }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {v.status !== "Sold" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={onAddExpense} style={btnStyle(C.blue)}><Ico name="plus" size={16} color={C.white} />Add Expense</button>
          <button onClick={onSell}       style={btnStyle(C.green)}><Ico name="dollar" size={16} color={C.white} />Mark as Sold</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 0, borderBottom: `1.5px solid ${C.border}` }}>
        {[
          { key: "expenses",  label: `Expenses (${v.expenses.length})`,   icon: "dollar" },
          { key: "documents", label: `Documents (${receipts.length})`,     icon: "folder" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ background: "none", border: "none", borderBottom: tab === t.key ? `3px solid ${C.blue}` : "3px solid transparent", color: tab === t.key ? C.blue : C.textMuted, padding: "10px 20px", fontWeight: tab === t.key ? 700 : 500, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: -1.5 }}>
            <Ico name={t.icon} size={15} color={tab === t.key ? C.blue : C.textMuted} />{t.label}
          </button>
        ))}
      </div>

      {/* ── Expenses tab ── */}
      {tab === "expenses" && (
        <div style={{ background: C.white, borderRadius: "0 0 14px 14px", border: `1.5px solid ${C.border}`, borderTop: "none", overflow: "hidden", marginBottom: 20 }}>
          {v.expenses.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: C.textMuted, fontSize: 14 }}>No expenses yet.</div>
          )}
          {v.expenses.map((e) => {
            const cc = CAT_COLORS[e.category] || CAT_COLORS.Other;
            return (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ background: cc.bg, color: cc.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>{e.category}</span>
                    <span style={{ fontWeight: 600, fontSize: 15, color: C.navy }}>{e.item}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{e.vendor || "-"} &middot; {e.date}</div>
                  {e.note && <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", marginTop: 2 }}>{e.note}</div>}
                  {/* Receipt thumbnails on expense row */}
                  {(e.receipts || []).length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {e.receipts.map((r, i) => (
                        <div key={i} onClick={() => onViewReceipt(r.dataUrl, r.name)} title="Click to view / download"
                          style={{ width: 48, height: 48, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.slateLight, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {r.type === "application/pdf"
                            ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><Ico name="file" size={14} color={C.amber} /><span style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</span></div>
                            : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="receipt" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 16 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: C.red }}>-{fmt(e.amount)}</span>
                  {v.status !== "Sold" && (
                    <button onClick={() => onDeleteExpense(e.id)} style={{ background: C.redLight, border: "none", cursor: "pointer", padding: 6, borderRadius: 8 }}>
                      <Ico name="trash" size={14} color={C.red} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {v.expenses.length > 0 && (
            <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end", background: C.slateLight }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Total: <span style={{ color: C.red }}>{fmt(totalExpenses)}</span></span>
            </div>
          )}
        </div>
      )}

      {/* ── Documents tab ── */}
      {tab === "documents" && (
        <div style={{ background: C.white, borderRadius: "0 0 14px 14px", border: `1.5px solid ${C.border}`, borderTop: "none", overflow: "hidden", marginBottom: 20 }}>
          {receipts.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: C.textMuted }}>
              <Ico name="folder" size={40} color={C.border} />
              <p style={{ marginTop: 12, fontSize: 14 }}>No documents stored yet. Scan or upload receipts when adding expenses.</p>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div style={{ padding: "12px 20px", background: C.blueLight, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>{receipts.length} document{receipts.length !== 1 ? "s" : ""} stored for tax purposes</span>
                <button
                  onClick={() => receipts.forEach((r, i) => setTimeout(() => downloadDataUrl(r.dataUrl, r.name || `receipt-${i + 1}`), i * 150))}
                  style={{ ...btnStyle(C.blue), padding: "6px 14px", fontSize: 12 }}>
                  <Ico name="download" size={14} color={C.white} /> Download All
                </button>
              </div>

              {/* Document list */}
              {receipts.map((r, i) => {
                const isPdf = r.type === "application/pdf";
                const filename = r.name || `receipt-${i + 1}`;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
                    {/* Thumbnail */}
                    <div onClick={() => onViewReceipt(r.dataUrl, filename)} style={{ width: 60, height: 60, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.slateLight, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isPdf
                        ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><Ico name="file" size={22} color={C.amber} /><span style={{ fontSize: 10, color: C.amber, fontWeight: 700 }}>PDF</span></div>
                        : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="receipt" />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.expenseItem} — {r.expenseVendor || "Unknown vendor"}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{r.expenseDate} &middot; {isPdf ? "PDF document" : "Image"}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filename}</div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button onClick={() => onViewReceipt(r.dataUrl, filename)} title="View" style={{ ...btnStyle(C.blueLight, C.blue), padding: "7px 12px", fontSize: 13 }}>
                        <Ico name="eye" size={15} color={C.blue} />
                      </button>
                      <button onClick={() => downloadDataUrl(r.dataUrl, filename)} title="Download" style={{ ...btnStyle(C.green), padding: "7px 12px", fontSize: 13 }}>
                        <Ico name="download" size={15} color={C.white} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {v.status === "Sold" && (
        <div style={{ background: C.greenLight, border: `1.5px solid ${C.green}`, borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>🏁</span>
          <span style={{ color: C.green, fontWeight: 700 }}>Sold for {fmt(v.salePrice)} on {v.soldDate} — profit of {fmt(profit)}</span>
        </div>
      )}

      <div style={{ paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
        {!confirmDelete
          ? <button onClick={() => setConfirmDelete(true)} style={{ background: C.redLight, color: C.red, border: `1.5px solid ${C.red}`, padding: "8px 18px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Delete Vehicle</button>
          : <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: C.red, fontSize: 14, fontWeight: 500 }}>Are you sure? This cannot be undone.</span>
              <button onClick={onDelete} style={{ ...btnStyle(C.red), fontSize: 14 }}>Yes, Delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ background: C.white, color: C.textMid, border: `1.5px solid ${C.border}`, padding: "8px 16px", borderRadius: 8, fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADD VEHICLE FORM
// ─────────────────────────────────────────────
function AddVehicleForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ year: "", make: "", model: "", trim: "", vin: "", mileage: "", purchaseDate: new Date().toISOString().slice(0, 10), purchasePrice: "", estimatedSale: "" });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const models = form.make ? Object.keys(VEHICLE_DB[form.make] || {}).sort() : [];
  const trims  = form.make && form.model ? (VEHICLE_DB[form.make]?.[form.model] || []) : [];

  const Sel = ({ label, val, opts, onChange, placeholder }) => (
    <div>
      <label style={lbl}>{label}</label>
      <select style={inp} value={val} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
  const Fld = ({ label, val, onChange, placeholder, type = "text", full }) => (
    <div style={full ? { gridColumn: "1 / -1" } : {}}>
      <label style={lbl}>{label}</label>
      <input style={inp} type={type} value={val} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <div>
      {backBtn(onCancel)}
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 20px", color: C.navy }}>Add Vehicle</h1>
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <Sel label="Year"  val={form.year}  opts={YEARS} onChange={(v) => set("year", v)} placeholder="Select year..." />
          <Sel label="Make"  val={form.make}  opts={MAKES} onChange={(v) => { set("make", v); set("model", ""); set("trim", ""); }} placeholder="Select make..." />
          <Sel label="Model" val={form.model} opts={models} onChange={(v) => { set("model", v); set("trim", ""); }} placeholder={form.make ? "Select model..." : "Select make first"} />
          <Sel label="Trim"  val={form.trim}  opts={trims} onChange={(v) => set("trim", v)} placeholder={trims.length ? "Select trim..." : "Select model first"} />
          <Fld label="VIN (optional)" val={form.vin} onChange={(v) => set("vin", v)} placeholder="1HGCM82633A123456" full />
          <Fld label="Mileage (km)"       val={form.mileage}       onChange={(v) => set("mileage", v)}       placeholder="142000" type="number" />
          <Fld label="Purchase Date"       val={form.purchaseDate}  onChange={(v) => set("purchaseDate", v)}  type="date" />
          <Fld label="Purchase Price (CAD)" val={form.purchasePrice} onChange={(v) => set("purchasePrice", v)} placeholder="6800" type="number" />
          <Fld label="Est. Sale Price (CAD)" val={form.estimatedSale} onChange={(v) => set("estimatedSale", v)} placeholder="12500" type="number" />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button onClick={() => {
            if (!form.year || !form.make || !form.model || !form.purchasePrice) { alert("Year, Make, Model, and Purchase Price are required."); return; }
            onSave({ ...form, purchasePrice: Number(form.purchasePrice), estimatedSale: Number(form.estimatedSale) || 0 });
          }} style={btnStyle(C.blue)}>
            <Ico name="plus" size={16} color={C.white} /> Add Vehicle
          </button>
          <button onClick={onCancel} style={{ background: C.white, color: C.textMid, border: `1.5px solid ${C.border}`, padding: "10px 20px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ADD EXPENSE FORM
// ─────────────────────────────────────────────
function AddExpenseForm({ vehicle, onSave, onCancel, scanResult, setScanResult, scanLoading, scanError, pendingReceipts, setPendingReceipts, onScan, cameraRef, uploadRef }) {
  const [category, setCategory] = useState("Mechanical");
  const [form, setForm] = useState({ item: "Battery", amount: "", vendor: "", date: new Date().toISOString().slice(0, 10), note: "", customItem: "" });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const applyResult = () => {
    if (!scanResult) return;
    setForm((p) => ({ ...p, item: scanResult.item || p.item, amount: scanResult.amount || p.amount, vendor: scanResult.vendor || p.vendor, date: scanResult.date || p.date, note: scanResult.note || p.note }));
    if (scanResult.category) setCategory(scanResult.category);
    setScanResult(null);
  };

  const items = EXPENSE_CATEGORIES[category] || [];
  const isCustom = form.item === "Custom...";
  const cc = CAT_COLORS[category] || CAT_COLORS.Other;

  const handleSave = () => {
    const finalItem = isCustom ? form.customItem : form.item;
    if (!finalItem || !form.amount) { alert("Item and amount are required."); return; }
    onSave({ category, item: finalItem, amount: Number(form.amount), vendor: form.vendor, date: form.date, note: form.note, receipts: pendingReceipts });
  };

  return (
    <div>
      {backBtn(onCancel)}
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: C.navy }}>Add Expense</h1>
      <p style={{ color: C.textMuted, margin: "0 0 20px", fontSize: 14 }}>{vehicle.year} {vehicle.make} {vehicle.model}</p>

      {/* AI Scanner */}
      <div style={{ background: C.navy, borderRadius: 14, padding: "20px 22px", marginBottom: 20, color: C.white }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Ico name="spark" size={18} color={C.amber} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>AI Receipt Scanner</span>
          <span style={{ background: C.amber, color: C.white, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>SMART</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "0 0 14px" }}>
          Take a photo or upload an image / PDF. AI reads it and fills the form. Every document is saved to this vehicle's Documents tab for CRA tax records.
        </p>

        <input type="file" accept="image/*" capture="environment" ref={cameraRef} style={{ display: "none" }} onChange={(e) => e.target.files[0] && onScan(e.target.files[0])} />
        <input type="file" accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.heic,.webp" ref={uploadRef} style={{ display: "none" }} onChange={(e) => e.target.files[0] && onScan(e.target.files[0])} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => cameraRef.current?.click()} disabled={scanLoading} style={{ background: C.amber, color: C.white, border: "none", padding: "9px 18px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Ico name="camera" size={16} color={C.white} /> Take Photo
          </button>
          <button onClick={() => uploadRef.current?.click()} disabled={scanLoading} style={{ background: "rgba(255,255,255,0.15)", color: C.white, border: "1.5px solid rgba(255,255,255,0.3)", padding: "9px 18px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Ico name="upload" size={16} color={C.white} /> Upload Image / PDF
          </button>
        </div>

        {scanLoading && <p style={{ color: C.amber, fontSize: 13, marginTop: 10, fontWeight: 600 }}>Scanning receipt...</p>}
        {scanError  && <p style={{ color: "#FF5252", fontSize: 13, marginTop: 10 }}>{scanError}</p>}
        {scanResult && (
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 16px", marginTop: 12, border: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Found: {scanResult.item} — ${scanResult.amount}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{scanResult.vendor}{scanResult.date ? ` · ${scanResult.date}` : ""}</div>
            <button onClick={applyResult} style={{ ...btnStyle(C.amber), marginTop: 10, fontSize: 13, padding: "7px 16px" }}>Apply to Form</button>
          </div>
        )}

        {pendingReceipts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8, fontWeight: 600 }}>
              Attached ({pendingReceipts.length}) — will save to Documents
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pendingReceipts.map((r, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.3)", overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {r.type === "application/pdf"
                      ? <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><Ico name="file" size={16} color={C.amber} /><span style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</span></div>
                      : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
                  </div>
                  <button onClick={() => setPendingReceipts((p) => p.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: -6, right: -6, background: C.red, border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <Ico name="trash" size={9} color={C.white} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expense form */}
      <div style={card}>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.keys(EXPENSE_CATEGORIES).map((cat) => {
              const cc2 = CAT_COLORS[cat] || CAT_COLORS.Other;
              const active = category === cat;
              return (
                <button key={cat} onClick={() => { setCategory(cat); set("item", EXPENSE_CATEGORIES[cat][0]); }}
                  style={{ background: active ? cc2.bg : C.slateLight, color: active ? cc2.color : C.textMuted, border: `1.5px solid ${active ? cc2.color : C.border}`, padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Item</label>
          <select style={inp} value={form.item} onChange={(e) => set("item", e.target.value)}>
            {items.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>

        {isCustom && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Describe the item</label>
            <input style={inp} value={form.customItem} placeholder="e.g. Door lock actuator" onChange={(e) => set("customItem", e.target.value)} />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div><label style={lbl}>Amount (CAD)</label><input style={inp} type="number" value={form.amount} placeholder="275" onChange={(e) => set("amount", e.target.value)} /></div>
          <div><label style={lbl}>Vendor</label><input style={inp} value={form.vendor} placeholder="ABC Auto Parts" onChange={(e) => set("vendor", e.target.value)} /></div>
          <div><label style={lbl}>Date</label><input style={inp} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div><label style={lbl}>Notes (optional)</label><input style={inp} value={form.note} placeholder="Used part, scrapyard" onChange={(e) => set("note", e.target.value)} /></div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <button onClick={handleSave} style={btnStyle(cc.color)}>Save Expense</button>
          <button onClick={onCancel} style={{ background: C.white, color: C.textMid, border: `1.5px solid ${C.border}`, padding: "10px 20px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SELL FORM
// ─────────────────────────────────────────────
function SellForm({ vehicle, onSave, onCancel }) {
  const { totalCost } = calcVehicle(vehicle);
  const [salePrice, setSalePrice] = useState(vehicle.estimatedSale || "");
  const [soldDate, setSoldDate] = useState(new Date().toISOString().slice(0, 10));
  const profit = Number(salePrice) - totalCost;
  const margin = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return (
    <div>
      {backBtn(onCancel)}
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 20px", color: C.navy }}>Mark as Sold</h1>
      <div style={card}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>{vehicle.year} {vehicle.make} {vehicle.model}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>Total invested: {fmt(totalCost)}</div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={lbl}>Sale Price (CAD)</label><input style={inp} type="number" value={salePrice} placeholder="12500" onChange={(e) => setSalePrice(e.target.value)} /></div>
        <div style={{ marginBottom: 14 }}><label style={lbl}>Sale Date</label><input style={inp} type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} /></div>
        {salePrice > 0 && (
          <div style={{ background: profit >= 0 ? C.greenLight : C.redLight, border: `1.5px solid ${profit >= 0 ? C.green : C.red}`, borderRadius: 10, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <ProfitRing margin={margin} size={52} />
            <div>
              <div style={{ fontSize: 13, color: C.textMuted }}>Net Profit</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: profit >= 0 ? C.green : C.red }}>{fmt(profit)}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{margin.toFixed(1)}% margin</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => { if (!salePrice) { alert("Enter a sale price."); return; } onSave({ salePrice: Number(salePrice), soldDate }); }} style={btnStyle(C.green)}>
            <Ico name="check" size={16} color={C.white} /> Confirm Sale
          </button>
          <button onClick={onCancel} style={{ background: C.white, color: C.textMid, border: `1.5px solid ${C.border}`, padding: "10px 20px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
