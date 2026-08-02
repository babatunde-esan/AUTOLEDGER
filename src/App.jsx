import { useState, useEffect, useRef, useCallback } from "react";
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
  purple: "#7B1FA2", purpleLight: "#F3E5F5",
  slate: "#78909C", slateLight: "#ECEFF1", textMid: "#37474F", textMuted: "#78909C",
  border: "#E3E8F0",
};

// ── Ontario Copart/IAA Fee Structure ─────────────────────────────────────────
// Buyer fee tiers based on sale price (approximate Copart Canada rates)
function calcBuyerFee(salePrice) {
  const p = Number(salePrice) || 0;
  if (p <= 99)    return 25;
  if (p <= 499)   return 65;
  if (p <= 999)   return 90;
  if (p <= 1499)  return 115;
  if (p <= 1999)  return 140;
  if (p <= 2999)  return 175;
  if (p <= 3999)  return 225;
  if (p <= 4999)  return 275;
  if (p <= 5999)  return 325;
  if (p <= 6999)  return 375;
  if (p <= 7999)  return 425;
  if (p <= 9999)  return 475;
  if (p <= 11999) return 525;
  if (p <= 13999) return 575;
  return 625;
}

const FIXED_FEES = {
  virtualBidFee: 109,
  gateFee: 79,
  omvicFee: 22,
  carfaxFee: 39.55,
  transport: 300,
  safety: 110,
};
const HST_RATE = 0.13;

function calcAuctionTotal(salePrice) {
  const p = Number(salePrice) || 0;
  const buyerFee = calcBuyerFee(p);
  const subtotal = p + buyerFee + FIXED_FEES.virtualBidFee + FIXED_FEES.gateFee + FIXED_FEES.omvicFee + FIXED_FEES.carfaxFee;
  const hst = Math.round((subtotal) * HST_RATE * 100) / 100;
  const totalAuctionCost = subtotal + hst;
  return { buyerFee, subtotal, hst, totalAuctionCost };
}


// ── LocalStorage for large files (PDFs stay on device, not Firestore) ────────
const LS_PREFIX = "al_receipt_";

function saveFileLocally(id, dataUrl) {
  try { localStorage.setItem(LS_PREFIX + id, dataUrl); return true; }
  catch (e) { console.warn("LocalStorage full, file not cached locally:", e); return false; }
}

function loadFileLocally(id) {
  try { return localStorage.getItem(LS_PREFIX + id); }
  catch { return null; }
}

// Estimate base64 size in bytes
function estimateSize(dataUrl) {
  return Math.round((dataUrl.length * 3) / 4);
}

// Max size to store in Firestore per receipt (200KB compressed)
const MAX_FIRESTORE_RECEIPT = 200 * 1024;

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
  Fees: ["Safety Certificate","Licensing","Registration","Inspection","Storage","Towing","Auction Fee","Buyer Fee","HST","Environmental Fee","Virtual Bid Fee","Gate Fee"],
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
const fmtDec = (n) => new Intl.NumberFormat("en-CA", { style:"currency", currency:"CAD", minimumFractionDigits:2, maximumFractionDigits:2 }).format(n || 0);
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

// Compress image before storing (keeps Firestore docs small)
function compressImage(dataUrl, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback
    img.src = dataUrl;
  });
}

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

// Export all vehicles to CSV
function exportToCSV(vehicles) {
  const rows = [["Year","Make","Model","Trim","VIN","Mileage","Purchase Date","Purchase Price","Total Expenses","Total Cost","Status","Sale Price","Profit","Margin %"]];
  vehicles.forEach((v) => {
    const { totalExpenses, totalCost, profit, margin } = calcVehicle(v);
    rows.push([v.year,v.make,v.model,v.trim||"",v.vin||"",v.mileage||"",v.purchaseDate,v.purchasePrice,totalExpenses,totalCost,v.status,v.salePrice||"",profit.toFixed(0),margin.toFixed(1)+"%"]);
  });
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  downloadDataUrl(URL.createObjectURL(blob), `AutoLedger_Export_${today()}.csv`);
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
    edit:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    search:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    calc:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="14" y1="18" x2="16" y2="18"/></svg>,
    note:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    export:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
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
  const fs  = size === "lg" ? 17 : size === "sm" ? 13 : 15;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background: outline ? "transparent" : color, color: outline ? color : textColor, border: `2px solid ${color}`, padding: pad, borderRadius: 12, fontWeight: 700, fontSize: fs, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: full ? "100%" : "auto", opacity: disabled ? 0.6 : 1, fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", full }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : {}}>
      <label style={S.label}>{label}</label>
      <input style={S.input} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
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

// ── AI Scanner (shared hook-like component) ───────────────────────────────────
function AIScanner({ title, description, onFile, scanning, scanError, scanResult, onApply, pendingFiles, onRemoveFile, accentColor = C.navy }) {
  const cameraRef = useRef();
  const uploadRef = useRef();
  return (
    <div style={{ background: `linear-gradient(135deg, ${accentColor}, #283593)`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Ico name="spark" size={18} color={C.amber} />
        <span style={{ fontWeight: 800, fontSize: 16, color: C.white }}>{title}</span>
        <span style={{ background: C.amber, color: C.white, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>AI</span>
      </div>
      <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>{description}</p>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
      <input ref={uploadRef} type="file" accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.heic,.webp"
        style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={() => cameraRef.current?.click()} disabled={scanning}
          style={{ background: C.amber, border: "none", borderRadius: 12, padding: "14px 10px", cursor: scanning ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: scanning ? 0.7 : 1 }}>
          <Ico name="camera" size={26} color={C.white} />
          <span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>Take Photo</span>
        </button>
        <button onClick={() => uploadRef.current?.click()} disabled={scanning}
          style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "14px 10px", cursor: scanning ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: scanning ? 0.7 : 1 }}>
          <Ico name="upload" size={26} color={C.white} />
          <span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>Upload PDF/Image</span>
        </button>
      </div>
      {scanning && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <div style={{ width: 18, height: 18, border: "3px solid rgba(255,255,255,0.3)", borderTop: `3px solid ${C.amber}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          <span style={{ color: C.amber, fontWeight: 600, fontSize: 14 }}>Scanning with AI...</span>
        </div>
      )}
      {scanError && (
        <div style={{ background: "rgba(229,57,53,0.2)", border: "1px solid rgba(229,57,53,0.5)", borderRadius: 10, padding: "12px 14px", marginTop: 12 }}>
          <div style={{ color: "#FF8A80", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>⚠️ Scan issue</div>
          <div style={{ color: "#FF8A80", fontSize: 12, lineHeight: 1.4 }}>{scanError}</div>
        </div>
      )}
      {scanResult && (
        <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 14, marginTop: 12, border: "1px solid rgba(255,255,255,0.2)" }}>
          <div style={{ fontWeight: 700, color: C.white, marginBottom: 6, fontSize: 14 }}>✅ {scanResult.summary}</div>
          {scanResult.details && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 10, lineHeight: 1.5 }}>{scanResult.details}</div>}
          <button onClick={onApply} style={{ background: C.amber, border: "none", borderRadius: 10, padding: "10px 20px", color: C.white, fontWeight: 700, fontSize: 14, cursor: "pointer", width: "100%" }}>
            Apply to Form ✓
          </button>
        </div>
      )}
      {pendingFiles && pendingFiles.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 }}>
            Attached ({pendingFiles.length})
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pendingFiles.map((r, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, border: "2px solid rgba(255,255,255,0.25)", overflow: "hidden", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {r.type === "application/pdf" || r.name?.endsWith(".pdf")
                    ? <div style={{ textAlign: "center" }}><Ico name="file" size={18} color={C.amber} /><div style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</div></div>
                    : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />}
                </div>
                {onRemoveFile && (
                  <button onClick={() => onRemoveFile(i)} style={{ position: "absolute", top: -6, right: -6, background: C.red, border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <Ico name="x" size={12} color={C.white} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROOT APP ─────────────────────────────────────────────────────────────────
export default function AutoLedger() {
  const [vehicles, setVehicles]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [dbError, setDbError]       = useState(null);
  const [view, setView]             = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [lightbox, setLightbox]     = useState(null);

  const selected = vehicles.find((v) => v.id === selectedId);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vehicles"),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setVehicles(docs); setLoading(false);
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
    try { await addDoc(collection(db, "vehicles"), { ...data, expenses: [], status: "In Repair", notes: "", createdAt: serverTimestamp() }); setView("list"); }
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

  async function editVehicle(vehicleId, data) {
    setSaving(true);
    try { await updateDoc(doc(db, "vehicles", vehicleId), data); setView("detail"); }
    catch { alert("Update failed."); }
    finally { setSaving(false); }
  }

  async function saveNotes(vehicleId, notes) {
    await updateDoc(doc(db, "vehicles", vehicleId), { notes });
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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;-webkit-tap-highlight-color:transparent} body{margin:0;background:#F0F4FF} input,select,button,textarea{font-family:inherit}`}</style>
    </div>
  );

  if (dbError) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, gap: 12, padding: 24, textAlign: "center" }}>
      <span style={{ fontSize: 48 }}>⚠️</span>
      <h2 style={{ color: C.red, margin: 0 }}>Database Error</h2>
      <p style={{ color: C.textMuted, maxWidth: 360 }}>{dbError}</p>
      <p style={{ color: C.textMuted, fontSize: 13 }}>Firebase Console → Firestore → Rules → set <code>allow read, write: if true</code> → Publish</p>
    </div>
  );

  const navTo = (v, id) => { if (id) setSelectedId(id); setView(v); };
  const backView = ["addExpense","sell","docs","editVehicle","notes"].includes(view) ? "detail" : "list";

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, minHeight: "100vh", color: C.navy, maxWidth: 600, margin: "0 auto" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        body{margin:0;background:#F0F4FF}
        input,select,button,textarea{font-family:inherit}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
      `}</style>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setLightbox(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 500 }}>
            {lightbox.isPdf || lightbox.name?.endsWith(".pdf") || !lightbox.dataUrl
              ? <div style={{ background: C.white, borderRadius: 16, padding: 40, textAlign: "center" }}>
                  <Ico name="file" size={56} color={C.amber} />
                  <p style={{ color: C.textMid, marginTop: 12, fontWeight: 600 }}>{lightbox.name}</p>
                  {!lightbox.dataUrl && <p style={{ color: C.textMuted, fontSize: 13, marginTop: 8 }}>PDF stored on original device. Open AutoLedger on that device to download.</p>}
                </div>
              : <img src={lightbox.dataUrl} alt="receipt" style={{ width: "100%", borderRadius: 12, objectFit: "contain", maxHeight: "70vh" }} />}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              {lightbox.dataUrl && <Btn full color={C.green} onClick={() => downloadDataUrl(lightbox.dataUrl, lightbox.name)}><Ico name="download" size={18} color={C.white} />Download</Btn>}
              <Btn full outline color={C.white} textColor={C.white} onClick={() => setLightbox(null)}><Ico name="x" size={18} color={C.white} />Close</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ background: C.navy, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 16px rgba(26,35,126,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {view !== "dashboard" && view !== "list" && (
              <button onClick={() => navTo(backView)} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex" }}>
                <Ico name="back" size={20} color={C.white} />
              </button>
            )}
            <div style={{ background: C.amber, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: C.white }}>AL</div>
            <span style={{ fontWeight: 800, fontSize: 16, color: C.white }}>AutoLedger</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => navTo("calculator")} style={{ background: view === "calculator" ? "rgba(255,255,255,0.2)" : "none", border: "none", color: C.white, cursor: "pointer", padding: "6px 8px", borderRadius: 8 }} title="Deal Calculator">
              <Ico name="calc" size={18} color={C.white} />
            </button>
            <button onClick={() => exportToCSV(vehicles)} style={{ background: "none", border: "none", color: C.white, cursor: "pointer", padding: "6px 8px", borderRadius: 8 }} title="Export CSV">
              <Ico name="export" size={18} color={C.white} />
            </button>
            <button onClick={() => navTo("addVehicle")} style={{ background: C.amber, border: "none", color: C.white, cursor: "pointer", padding: "6px 12px", borderRadius: 8, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <Ico name="plus" size={16} color={C.white} />Add
            </button>
          </div>
        </div>
      </header>

      {saving && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: C.navy, color: C.white, padding: "10px 20px", borderRadius: 24, fontSize: 14, fontWeight: 600, zIndex: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
          Saving to Firebase...
        </div>
      )}

      <main style={{ padding: "16px 16px 100px" }}>
        {view === "dashboard"    && <Dashboard stats={stats} vehicles={vehicles} onSelect={(id) => navTo("detail", id)} onCalc={() => navTo("calculator")} />}
        {view === "list"         && <VehicleList vehicles={vehicles} onSelect={(id) => navTo("detail", id)} onAdd={() => navTo("addVehicle")} />}
        {view === "calculator"   && <DealCalculator />}
        {view === "detail"       && selected && <VehicleDetail vehicle={selected} onAddExpense={() => navTo("addExpense")} onEdit={() => navTo("editVehicle")} onSell={() => navTo("sell")} onDelete={() => deleteVehicle(selected.id)} onDeleteExpense={(eid) => deleteExpense(selected.id, eid)} onViewDocs={() => navTo("docs")} onViewReceipt={setLightbox} onNotes={() => navTo("notes")} />}
        {view === "addVehicle"   && <AddVehicleForm onSave={addVehicle} saving={saving} />}
        {view === "editVehicle"  && selected && <EditVehicleForm vehicle={selected} onSave={(d) => editVehicle(selected.id, d)} saving={saving} />}
        {view === "addExpense"   && selected && <AddExpenseForm vehicle={selected} onSave={(exp) => saveExpense(selected.id, exp)} saving={saving} />}
        {view === "sell"         && selected && <SellForm vehicle={selected} onSave={(d) => markSold(selected.id, d)} saving={saving} />}
        {view === "docs"         && selected && <DocumentVault vehicle={selected} onViewReceipt={setLightbox} />}
        {view === "notes"        && selected && <NotesScreen vehicle={selected} onSave={(n) => saveNotes(selected.id, n)} />}
      </main>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 600, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 env(safe-area-inset-bottom)", zIndex: 100 }}>
        {[
          { id: "dashboard", icon: "chart",      label: "Dashboard" },
          { id: "list",      icon: "car",        label: "Vehicles" },
          { id: "addVehicle",icon: "plus",       label: "Add",    amber: true },
          { id: "calculator",icon: "calc",       label: "Calculator" },
        ].map(({ id, icon, label, amber }) => {
          const active = view === id || (id === "list" && ["detail","addExpense","sell","docs","editVehicle","notes"].includes(view));
          return (
            <button key={id} onClick={() => navTo(id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0" }}>
              <div style={{ background: amber ? C.amber : active ? C.blueLight : "transparent", borderRadius: 12, padding: "6px 14px" }}>
                <Ico name={icon} size={21} color={amber ? C.white : active ? C.blue : C.slate} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: amber ? C.amber : active ? C.blue : C.slate }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ stats, vehicles, onSelect, onCalc }) {
  const soldVehicles = vehicles.filter((v) => v.status === "Sold");
  const avgMargin = soldVehicles.reduce((s, v) => { const { totalCost, profit } = calcVehicle(v); return s + (totalCost > 0 ? (profit / totalCost) * 100 : 0); }, 0) / Math.max(1, soldVehicles.length);
  const bestDeal = soldVehicles.reduce((best, v) => { const { profit } = calcVehicle(v); return profit > (best ? calcVehicle(best).profit : -Infinity) ? v : best; }, null);

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px", color: C.navy }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Inventory Value", value: fmt(stats.inventory), sub: `${stats.active} active`, accent: C.blue, bg: C.blueLight, icon: "🚗" },
          { label: "Total Invested",  value: fmt(stats.invested),  sub: "all vehicles",           accent: C.navy, bg: "#EDE7F6",   icon: "💰" },
          { label: "Total Profit",    value: fmt(stats.profit),    sub: `${stats.sold} sold`,      accent: C.green, bg: C.greenLight,icon: "📈" },
          { label: "Avg Margin",      value: avgMargin.toFixed(1) + "%", sub: "per sold deal",    accent: C.amber, bg: C.amberLight,icon: "🎯" },
        ].map((sc) => (
          <div key={sc.label} style={{ background: sc.bg, borderRadius: 14, padding: "14px 16px", border: `1.5px solid ${sc.accent}22` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: sc.accent, textTransform: "uppercase", letterSpacing: 0.8 }}>{sc.label}</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: sc.accent, margin: "4px 0 2px" }}>{sc.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{sc.sub}</div>
          </div>
        ))}
      </div>

      {/* Deal Calculator CTA */}
      <div onClick={onCalc} style={{ ...S.card, padding: "14px 16px", marginBottom: 16, cursor: "pointer", background: `linear-gradient(135deg, ${C.navy}, #283593)`, border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: C.amber, borderRadius: 12, padding: 10 }}><Ico name="calc" size={22} color={C.white} /></div>
          <div>
            <div style={{ fontWeight: 700, color: C.white, fontSize: 15 }}>Pre-Buy Deal Calculator</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Know your max bid before the auction</div>
          </div>
          <div style={{ marginLeft: "auto" }}><Ico name="back" size={18} color="rgba(255,255,255,0.4)" style={{ transform: "rotate(180deg)" }} /></div>
        </div>
      </div>

      {bestDeal && (
        <div style={{ ...S.card, padding: "14px 16px", marginBottom: 16, border: `1.5px solid ${C.green}44`, background: C.greenLight }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>🏆 Best Deal</div>
          <div style={{ fontWeight: 700, color: C.navy }}>{bestDeal.year} {bestDeal.make} {bestDeal.model}</div>
          <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Profit: {fmt(calcVehicle(bestDeal).profit)}</div>
        </div>
      )}

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
            {vehicles.slice(0, 6).map((v) => <VehicleCard key={v.id} v={v} onSelect={onSelect} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Deal Calculator ───────────────────────────────────────────────────────────
function DealCalculator() {
  const [hammerprice, setHammerprice]   = useState("");
  const [repairs, setRepairs]           = useState("");
  const [targetSale, setTargetSale]     = useState("");
  const [targetMargin, setTargetMargin] = useState("20");
  const [transport, setTransport]       = useState(String(FIXED_FEES.transport));
  const [safety, setSafety]             = useState(String(FIXED_FEES.safety));

  const p     = Number(hammerprice) || 0;
  const rep   = Number(repairs)     || 0;
  const sale  = Number(targetSale)  || 0;
  const trans = Number(transport)   || 0;
  const saf   = Number(safety)      || 0;
  const mgn   = Number(targetMargin)|| 20;

  const { buyerFee, hst, totalAuctionCost } = calcAuctionTotal(p);
  const totalCost   = totalAuctionCost + rep + trans + saf;
  const profit      = sale > 0 ? sale - totalCost : 0;
  const margin      = totalCost > 0 && sale > 0 ? (profit / totalCost) * 100 : 0;
  const maxBid      = sale > 0 ? (() => {
    const fixedCosts = rep + trans + saf + FIXED_FEES.virtualBidFee + FIXED_FEES.gateFee + FIXED_FEES.omvicFee + FIXED_FEES.carfaxFee;
    const targetProfit = sale * (mgn / 100);
    const available = sale - fixedCosts - targetProfit;
    let lo = 0, hi = available, guess = 0;
    for (let i = 0; i < 50; i++) {
      guess = (lo + hi) / 2;
      const { totalAuctionCost: tac } = calcAuctionTotal(guess);
      const total = tac + rep + trans + saf;
      const pr = sale - total;
      const mr = total > 0 ? (pr / total) * 100 : 0;
      if (mr > mgn) lo = guess; else hi = guess;
    }
    return Math.floor(guess / 50) * 50;
  })() : 0;

  const verdict = !p ? null : margin >= 20 ? "go" : margin >= 10 ? "caution" : "pass";
  const verdictStyle = { go: { bg: C.greenLight, color: C.green, icon: "✅", text: "Good deal — go for it" }, caution: { bg: C.amberLight, color: C.amber, icon: "⚠️", text: "Thin margin — proceed carefully" }, pass: { bg: C.redLight, color: C.red, icon: "🚫", text: "Low margin — consider passing" } };

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Deal Calculator</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>Know your numbers before you bid</p>

      <div style={{ ...S.card, padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ ...S.section, margin: 0 }}>Auction Details</p>
        <Field label="Auction / Hammer Price (CAD)" value={hammerprice} onChange={setHammerprice} placeholder="5400" type="number" />

        {p > 0 && (
          <div style={{ background: C.blueLight, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.7 }}>Estimated Auction Fees (Copart/IAA)</div>
            {[
              ["Buyer Fee", buyerFee],
              ["Virtual Bid Fee", FIXED_FEES.virtualBidFee],
              ["Gate Fee", FIXED_FEES.gateFee],
              ["OMVIC Fee", FIXED_FEES.omvicFee],
              ["CarFax Fee", FIXED_FEES.carfaxFee],
              ["HST (13%)", hst],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: C.textMid }}>{label}</span>
                <span style={{ fontWeight: 600, color: C.navy }}>{fmtDec(val)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 4 }}>
              <span style={{ color: C.navy }}>Total Auction Cost</span>
              <span style={{ color: C.blue }}>{fmt(totalAuctionCost)}</span>
            </div>
          </div>
        )}

        <p style={{ ...S.section, margin: 0 }}>Additional Costs</p>
        <Field label="Estimated Repairs (CAD)" value={repairs} onChange={setRepairs} placeholder="1500" type="number" />
        <Field label="Transport (CAD)" value={transport} onChange={setTransport} placeholder="300" type="number" />
        <Field label="Safety Certificate (CAD)" value={safety} onChange={setSafety} placeholder="110" type="number" />

        <p style={{ ...S.section, margin: 0 }}>Sale Targets</p>
        <Field label="Expected Sale Price (CAD)" value={targetSale} onChange={setTargetSale} placeholder="10000" type="number" />
        <Field label="Target Profit Margin %" value={targetMargin} onChange={setTargetMargin} placeholder="20" type="number" />
      </div>

      {/* Results */}
      {(p > 0 || sale > 0) && (
        <div style={{ ...S.card, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ background: C.navy, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Deal Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
              {[
                { label: "Total Cost", value: fmt(totalCost) },
                { label: "Est. Profit", value: fmt(profit), color: profit >= 0 ? "#69F0AE" : "#FF5252" },
                { label: "Margin", value: margin.toFixed(1) + "%", color: margin >= 20 ? "#69F0AE" : margin >= 10 ? C.amber : "#FF5252" },
              ].map((item, i, arr) => (
                <div key={i} style={{ padding: "10px 12px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.7 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: item.color || C.white, marginTop: 3 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {verdict && (
            <div style={{ background: verdictStyle[verdict].bg, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{verdictStyle[verdict].icon}</span>
              <span style={{ fontWeight: 700, color: verdictStyle[verdict].color, fontSize: 15 }}>{verdictStyle[verdict].text}</span>
            </div>
          )}

          {maxBid > 0 && (
            <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Max Bid for {targetMargin}% Margin</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.amber }}>{fmt(maxBid)}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Don't bid above this to hit your target</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vehicle Card ──────────────────────────────────────────────────────────────
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
        <div><div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Invested</div><div style={{ fontSize: 17, fontWeight: 700, color: C.textMid }}>{fmt(totalCost)}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{v.status === "Sold" ? "Profit" : "Est. Profit"}</div><div style={{ fontSize: 17, fontWeight: 700, color: profit >= 0 ? C.green : C.red }}>{fmt(profit)}</div></div>
      </div>
    </div>
  );
}

// ── Vehicle List ──────────────────────────────────────────────────────────────
function VehicleList({ vehicles, onSelect, onAdd }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = vehicles
    .filter((v) => filter === "All" || v.status === filter)
    .filter((v) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return [v.year, v.make, v.model, v.trim, v.vin].some((f) => (f || "").toLowerCase().includes(q));
    });

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px" }}>Vehicles</h1><p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>{vehicles.length} total</p></div>
        <Btn color={C.amber} onClick={onAdd} size="sm"><Ico name="plus" size={16} color={C.white} />Add</Btn>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Ico name="search" size={17} color={C.textMuted} /></div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search make, model, year, VIN..."
          style={{ ...S.input, paddingLeft: 38, fontSize: 14 }} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {["All", "In Repair", "Available", "Sold"].map((t) => {
          const sm = STATUS_META[t];
          const active = filter === t;
          return <button key={t} onClick={() => setFilter(t)} style={{ background: active ? (sm ? sm.bg : C.blueLight) : C.white, color: active ? (sm ? sm.color : C.blue) : C.textMuted, border: `1.5px solid ${active ? (sm ? sm.color : C.blue) : C.border}`, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{t} {filter === t && `(${filtered.length})`}</button>;
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ ...S.card, padding: 40, textAlign: "center", color: C.textMuted }}>
          <div style={{ fontSize: 44 }}>🔍</div>
          <p style={{ fontWeight: 600 }}>{search ? "No matches found" : "No vehicles here"}</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((v) => <VehicleCard key={v.id} v={v} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

// ── Vehicle Detail ────────────────────────────────────────────────────────────
function VehicleDetail({ vehicle: v, onAddExpense, onEdit, onSell, onDelete, onDeleteExpense, onViewDocs, onViewReceipt, onNotes }) {
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
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{v.trim} · {Number(v.mileage || 0).toLocaleString()} km</div>
            <span style={{ background: sm.bg, color: sm.color, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{sm.icon} {v.status}</span>
          </div>
          <ProfitRing margin={margin} size={60} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 16, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden" }}>
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
        {v.vin && <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>VIN: {v.vin}</div>}
      </div>

      {/* Actions grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {v.status !== "Sold" && <>
          <Btn full color={C.blue} onClick={onAddExpense}><Ico name="plus" size={17} color={C.white} />Add Expense</Btn>
          <Btn full color={C.green} onClick={onSell}><Ico name="dollar" size={17} color={C.white} />Mark Sold</Btn>
        </>}
        <Btn full outline color={C.blue} onClick={onEdit}><Ico name="edit" size={16} color={C.blue} />Edit</Btn>
        <Btn full outline color={C.slate} onClick={onNotes}><Ico name="note" size={16} color={C.slate} />Notes{v.notes ? " ●" : ""}</Btn>
      </div>

      {/* Quick links */}
      {receipts.length > 0 && (
        <div onClick={onViewDocs} style={{ ...S.card, padding: "14px 16px", marginBottom: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: C.blueLight, borderRadius: 10, padding: 8 }}><Ico name="folder" size={20} color={C.blue} /></div>
            <div><div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Document Vault</div><div style={{ fontSize: 12, color: C.textMuted }}>{receipts.length} receipt{receipts.length !== 1 ? "s" : ""}</div></div>
          </div>
          <Ico name="back" size={18} color={C.textMuted} />
        </div>
      )}

      {/* Notes preview */}
      {v.notes && (
        <div style={{ ...S.card, padding: "14px 16px", marginBottom: 14, background: C.amberLight, border: `1.5px solid ${C.amber}33` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.5 }}>{v.notes}</div>
        </div>
      )}

      {/* Expenses */}
      <p style={S.section}>Expenses ({(v.expenses || []).length})</p>
      <div style={{ ...S.card, marginBottom: 14 }}>
        {(v.expenses || []).length === 0 && <div style={{ padding: "28px 16px", textAlign: "center", color: C.textMuted, fontSize: 14 }}>No expenses yet</div>}
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
                  {(e.receipts || []).length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {e.receipts.map((r, i) => (
                        <div key={i} onClick={() => {
                            const src = r.isPdf
                              ? (r.localId ? loadFileLocally(r.localId) : null)
                              : r.dataUrl;
                            onViewReceipt({ dataUrl: src, name: r.name, isPdf: r.isPdf, localId: r.localId });
                          }} style={{ width: 52, height: 52, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.slateLight, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {r.isPdf || r.type === "application/pdf" || r.name?.endsWith(".pdf")
                            ? <div style={{ textAlign: "center" }}><Ico name="file" size={16} color={C.amber} /><div style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</div></div>
                            : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="receipt" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginLeft: 12 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: C.red }}>-{fmt(e.amount)}</span>
                  {v.status !== "Sold" && <button onClick={() => onDeleteExpense(e.id)} style={{ background: C.redLight, border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}><Ico name="trash" size={15} color={C.red} /></button>}
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
          <div><div style={{ fontWeight: 700, color: C.green }}>Sold for {fmt(v.salePrice)}</div><div style={{ fontSize: 13, color: C.green }}>{v.soldDate} · Profit: {fmt(profit)}</div></div>
        </div>
      )}

      <Btn full outline color={C.red} onClick={onDelete} size="sm"><Ico name="trash" size={15} color={C.red} />Delete Vehicle</Btn>
    </div>
  );
}

// ── Notes Screen ──────────────────────────────────────────────────────────────
function NotesScreen({ vehicle: v, onSave }) {
  const [notes, setNotes] = useState(v.notes || "");
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await onSave(notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Notes</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>{v.year} {v.make} {v.model}</p>
      <div style={{ ...S.card, padding: 16, marginBottom: 14 }}>
        <label style={S.label}>Vehicle Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Waiting on transmission part, interested buyer at $9,500, follow up Friday..."
          style={{ ...S.input, height: 200, resize: "vertical", lineHeight: 1.6 }} />
        <div style={{ marginTop: 12 }}>
          <Btn full color={saved ? C.green : C.blue} onClick={handleSave}>
            {saved ? <><Ico name="check" size={18} color={C.white} />Saved!</> : "Save Notes"}
          </Btn>
        </div>
      </div>
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
          <p style={{ fontSize: 13 }}>Upload receipts when adding expenses — saved permanently for CRA.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Btn full color={C.blue} onClick={() => receipts.forEach((r, i) => setTimeout(() => downloadDataUrl(r.dataUrl, r.name || `receipt-${i + 1}`), i * 200))}>
              <Ico name="download" size={18} color={C.white} />Download All ({receipts.length})
            </Btn>
          </div>
          <div style={S.card}>
            {receipts.map((r, i) => {
              const isPdf = r.type === "application/pdf" || r.name?.endsWith(".pdf");
              const filename = r.name || `receipt-${i + 1}`;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < receipts.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div onClick={() => {
                    const src = r.isPdf ? (r.localId ? loadFileLocally(r.localId) : null) : r.dataUrl;
                    if (!src && r.isPdf) { alert("PDF was saved on another device. Re-upload to view it here."); return; }
                    onViewReceipt({ dataUrl: src, name: filename, isPdf: r.isPdf });
                  }} style={{ width: 56, height: 56, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.slateLight, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isPdf ? <div style={{ textAlign: "center" }}><Ico name="file" size={20} color={C.amber} /><div style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</div></div>
                      : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="receipt" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.expenseItem}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{r.expenseVendor || "—"} · {r.expenseDate}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {isPdf ? "PDF" : "Image"} · {filename}
                      {r.isPdf && !r.localId && <span style={{ color: C.amber, marginLeft: 6 }}>⚠ Open on original device to download</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => {
                      const src = r.isPdf ? (r.localId ? loadFileLocally(r.localId) : null) : r.dataUrl;
                      if (!src && r.isPdf) { alert("PDF saved on another device. Re-upload to access it here."); return; }
                      onViewReceipt({ dataUrl: src, name: filename, isPdf: r.isPdf });
                    }} style={{ background: C.blueLight, border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}><Ico name="eye" size={17} color={C.blue} /></button>
                    <button onClick={() => {
                      const src = r.isPdf ? (r.localId ? loadFileLocally(r.localId) : null) : r.dataUrl;
                      if (!src) { alert("File not available on this device."); return; }
                      downloadDataUrl(src, filename);
                    }} style={{ background: C.greenLight, border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}><Ico name="download" size={17} color={C.green} /></button>
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
  const [form, setForm]           = useState({ year: "", make: "", model: "", trim: "", vin: "", mileage: "", purchaseDate: today(), purchasePrice: "", estimatedSale: "" });
  const [scanning, setScanning]   = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanDoc, setScanDoc]     = useState(null);
  const [fieldsScanned, setFieldsScanned] = useState([]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const models = form.make ? Object.keys(VEHICLE_DB[form.make] || {}).sort() : [];
  const trims  = (form.make && form.model) ? (VEHICLE_DB[form.make]?.[form.model] || []) : [];

  function matchMake(raw) { if (!raw) return ""; const u = raw.toUpperCase(); return MAKES.find((m) => u.includes(m.toUpperCase())) || ""; }
  function matchModel(make, raw) { if (!make || !raw) return ""; const u = raw.toUpperCase(); return Object.keys(VEHICLE_DB[make] || {}).find((m) => u.includes(m.toUpperCase())) || ""; }
  function matchTrim(make, model, raw) { if (!make || !model || !raw) return ""; const u = raw.toUpperCase(); return (VEHICLE_DB[make]?.[model] || []).find((t) => u.includes(t.toUpperCase())) || ""; }

  async function scanDocument(file) {
    setScanning(true); setScanError(""); setScanResult(null); setFieldsScanned([]);
    try {
      const dataUrl = await fileToDataUrl(file);
      const base64  = dataUrl.split(",")[1];
      const isPdf   = file.type === "application/pdf";
      setScanDoc({ dataUrl, name: file.name || (isPdf ? "document.pdf" : "document.jpg") });

      const contentBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image",    source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } };

      const resp = await fetch("/api/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: `Extract vehicle purchase details from this document. Return ONLY valid JSON:\n{"year":"4-digit year","make":"manufacturer","model":"model name","trim":"trim level or empty","vin":"17-char VIN or empty","mileage":"odometer digits only or empty","purchaseDate":"YYYY-MM-DD or empty","purchasePrice":number or 0,"vendor":"seller name"}` }] }] }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        if (resp.status === 404) throw new Error("API proxy not found — make sure api/scan.js is in your GitHub repo.");
        if (resp.status === 401) throw new Error("Invalid API key — check ANTHROPIC_API_KEY in Vercel settings.");
        throw new Error(`Error ${resp.status}: ${txt.slice(0, 100)}`);
      }

      const data = await resp.json();
      if (data.error) throw new Error(`Anthropic: ${data.error.message}`);

      const text  = (data.content || []).map((b) => b.text || "").join("").trim();
      const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(clean);

      const filled = [];
      const updates = {};
      if (parsed.year && YEARS.includes(parsed.year))             { updates.year = parsed.year; filled.push("Year"); }
      const make = matchMake(parsed.make);
      if (make)                                                     { updates.make = make; filled.push("Make"); }
      const model = matchModel(make, parsed.model);
      if (model)                                                    { updates.model = model; filled.push("Model"); }
      const trim = matchTrim(make, model, parsed.trim);
      if (trim)                                                     { updates.trim = trim; filled.push("Trim"); }
      if (parsed.vin && parsed.vin.length === 17)                   { updates.vin = parsed.vin; filled.push("VIN"); }
      if (parsed.mileage && Number(parsed.mileage) > 0)            { updates.mileage = String(parsed.mileage); filled.push("Mileage"); }
      if (parsed.purchaseDate)                                      { updates.purchaseDate = parsed.purchaseDate; filled.push("Purchase Date"); }
      if (parsed.purchasePrice && Number(parsed.purchasePrice) > 0) { updates.purchasePrice = String(parsed.purchasePrice); filled.push("Purchase Price"); }

      setForm((p) => ({ ...p, ...updates }));
      setFieldsScanned(filled);
      setScanResult({ summary: `Auto-filled ${filled.length} field${filled.length !== 1 ? "s" : ""}`, details: filled.join(", ") });
      if (filled.length === 0) setScanError("Document scanned but no vehicle details found. Fill in manually.");
    } catch (e) {
      console.error(e);
      setScanError(e.message || "Could not read document.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px" }}>Add Vehicle</h1>
      <AIScanner title="AI Document Scanner" description="Upload your Copart/IAA bill of sale or any purchase document — AI reads it and fills the form automatically."
        onFile={scanDocument} scanning={scanning} scanError={scanError} scanResult={scanResult} onApply={() => setScanResult(null)}
        pendingFiles={scanDoc ? [scanDoc] : []} />
      <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Year"  value={form.year}  options={YEARS} onChange={(v) => set("year", v)} placeholder="Select year..." />
        <Select label="Make"  value={form.make}  options={MAKES} onChange={(v) => { set("make", v); set("model", ""); set("trim", ""); }} placeholder="Select make..." />
        <Select label="Model" value={form.model} options={models} onChange={(v) => { set("model", v); set("trim", ""); }} placeholder={form.make ? "Select model..." : "Select make first"} />
        <Select label="Trim"  value={form.trim}  options={trims}  onChange={(v) => set("trim", v)}  placeholder={trims.length ? "Select trim..." : "Select model first"} />
        <Field label="VIN" value={form.vin} onChange={(v) => set("vin", v)} placeholder="1HGCM82633A123456" />
        <Field label="Mileage (km)" value={form.mileage} onChange={(v) => set("mileage", v)} placeholder="142000" type="number" />
        <Field label="Purchase Date" value={form.purchaseDate} onChange={(v) => set("purchaseDate", v)} type="date" />
        <Field label="Purchase Price (CAD)" value={String(form.purchasePrice)} onChange={(v) => set("purchasePrice", v)} placeholder="5400" type="number" />
        <Field label="Estimated Sale Price (CAD)" value={String(form.estimatedSale)} onChange={(v) => set("estimatedSale", v)} placeholder="10000" type="number" />
        <Btn full color={C.blue} size="lg" disabled={saving} onClick={() => {
          if (!form.year || !form.make || !form.model || !form.purchasePrice) { alert("Year, Make, Model and Purchase Price are required."); return; }
          onSave({ ...form, purchasePrice: Number(form.purchasePrice), mileage: Number(form.mileage) || 0, estimatedSale: Number(form.estimatedSale) || 0 });
        }}>
          {saving ? "Saving..." : <><Ico name="plus" size={20} color={C.white} />Add Vehicle</>}
        </Btn>
      </div>
    </div>
  );
}

// ── Add Expense Form ──────────────────────────────────────────────────────────
function AddExpenseForm({ vehicle, onSave, saving }) {
  const [category, setCategory]   = useState("Mechanical");
  const [item, setItem]           = useState("Battery");
  const [customItem, setCustomItem] = useState("");
  const [amount, setAmount]       = useState("");
  const [vendor, setVendor]       = useState("");
  const [date, setDate]           = useState(today());
  const [note, setNote]           = useState("");
  const [receipts, setReceipts]   = useState([]);
  const [scanning, setScanning]   = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanRaw, setScanRaw]     = useState(null);
  const [scanError, setScanError] = useState("");

  const items    = EXPENSE_CATEGORIES[category] || [];
  const isCustom = item === "Custom...";
  const cc       = CAT_COLORS[category] || CAT_COLORS.Other;

  async function processFile(file) {
    setScanning(true); setScanError(""); setScanResult(null); setScanRaw(null);
    try {
      const dataUrl  = await fileToDataUrl(file);
      const isPdf    = file.type === "application/pdf";
      const mediaType = isPdf ? "application/pdf" : "image/jpeg";
      const fileName  = file.name || (isPdf ? "receipt.pdf" : "receipt.jpg");

      // For AI scanning always use the full file
      const base64ForScan = dataUrl.split(",")[1];

      // For STORAGE: PDFs go to localStorage only (too large for Firestore)
      // Images get compressed down to <200KB for Firestore
      let storedDataUrl;
      let localId = null;

      if (isPdf) {
        // Save full PDF to localStorage, store only a placeholder in Firestore
        localId = uid();
        saveFileLocally(localId, dataUrl);
        // Firestore gets a tiny marker, not the full PDF
        storedDataUrl = null;
      } else {
        // Compress image aggressively - target under 200KB
        let compressed = await compressImage(dataUrl, 800, 0.7);
        if (estimateSize(compressed) > MAX_FIRESTORE_RECEIPT) {
          compressed = await compressImage(dataUrl, 600, 0.5);
        }
        if (estimateSize(compressed) > MAX_FIRESTORE_RECEIPT) {
          compressed = await compressImage(dataUrl, 400, 0.4);
        }
        storedDataUrl = compressed;
      }

      setReceipts((prev) => [...prev, {
        dataUrl: isPdf ? dataUrl : storedDataUrl, // show full PDF in UI during this session
        firestoreDataUrl: storedDataUrl,            // what actually gets saved to Firestore
        localId,                                    // key to retrieve PDF from localStorage
        name: fileName,
        type: mediaType,
        isPdf,
      }]);

      const contentBlock = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image",    source: { type: "base64", media_type: mediaType, data: base64 } };

      const resp = await fetch("/api/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: `Scan this automotive receipt for a Canadian vehicle reseller. Return ONLY valid JSON:\n{"vendor":"store name","date":"YYYY-MM-DD or empty","amount":number,"item":"best match: Battery,Alternator,Starter,Transmission,Engine,Brakes,Suspension,Steering,Oil Change,Front Bumper,Rear Bumper,Front Fender,Rear Fender,Hood,Door,Mirror,Headlight,Tail Light,Windshield,Tire,Rim,Oil,Coolant,Mechanic Labor,Body Shop Labor,Painting,Detailing,Safety Certificate,Licensing,Auction Fee,Buyer Fee,HST,Other","category":"Mechanical|Exterior|Tires & Wheels|Fluids|Labor|Fees|Other","note":"key details"}` }] }] }),
      });

      if (!resp.ok) {
        if (resp.status === 404) throw new Error("API proxy not found — add api/scan.js to GitHub.");
        if (resp.status === 401) throw new Error("Invalid API key — check ANTHROPIC_API_KEY in Vercel.");
        throw new Error(`Error ${resp.status}`);
      }

      const data  = await resp.json();
      if (data.error) throw new Error(data.error.message);
      const text  = (data.content || []).map((b) => b.text || "").join("").trim();
      const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(clean);
      setScanRaw(parsed);
      setScanResult({ summary: `Found: ${parsed.item} — $${parsed.amount}`, details: parsed.vendor ? `${parsed.vendor}${parsed.date ? " · " + parsed.date : ""}${parsed.note ? " · " + parsed.note : ""}` : "" });
    } catch (e) {
      console.error(e);
      setScanError(e.message || "Could not read receipt.");
    } finally {
      setScanning(false);
    }
  }

  function applyResult() {
    if (!scanRaw) return;
    if (scanRaw.vendor) setVendor(scanRaw.vendor);
    if (scanRaw.date)   setDate(scanRaw.date);
    if (scanRaw.amount) setAmount(String(scanRaw.amount));
    if (scanRaw.note)   setNote(scanRaw.note);
    if (scanRaw.category && EXPENSE_CATEGORIES[scanRaw.category]) {
      setCategory(scanRaw.category);
      const matched = EXPENSE_CATEGORIES[scanRaw.category].find((i) => i === scanRaw.item);
      if (matched) setItem(matched);
    }
    setScanResult(null); setScanRaw(null);
  }

  function handleSave() {
    const finalItem = isCustom ? customItem : item;
    if (!finalItem || !amount) { alert("Item and amount are required."); return; }
    // Strip full PDF dataUrls before saving to Firestore - use firestoreDataUrl instead
    const firestoreReceipts = receipts.map((r) => ({
      name: r.name,
      type: r.type,
      isPdf: r.isPdf || false,
      localId: r.localId || null,
      // For images: use compressed version. For PDFs: null (stored in localStorage)
      dataUrl: r.firestoreDataUrl || (r.isPdf ? null : r.dataUrl) || null,
    }));
    onSave({ category, item: finalItem, amount: Number(amount), vendor, date, note, receipts: firestoreReceipts });
  }

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Add Expense</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>{vehicle.year} {vehicle.make} {vehicle.model}</p>
      <AIScanner title="AI Receipt Scanner" description="Take a photo or upload a receipt — AI reads it and fills the form. Files saved for CRA tax records."
        onFile={processFile} scanning={scanning} scanError={scanError} scanResult={scanResult} onApply={applyResult}
        pendingFiles={receipts} onRemoveFile={(i) => setReceipts((p) => p.filter((_, idx) => idx !== i))} />
      <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={S.label}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.keys(EXPENSE_CATEGORIES).map((cat) => {
              const cc2 = CAT_COLORS[cat] || CAT_COLORS.Other;
              const active = category === cat;
              return <button key={cat} onClick={() => { setCategory(cat); setItem(EXPENSE_CATEGORIES[cat][0]); }} style={{ background: active ? cc2.bg : C.slateLight, color: active ? cc2.color : C.textMuted, border: `1.5px solid ${active ? cc2.color : C.border}`, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cat}</button>;
            })}
          </div>
        </div>
        <Select label="Item" value={item} options={items} onChange={setItem} placeholder="Select item..." />
        {isCustom && <Field label="Describe item" value={customItem} onChange={setCustomItem} placeholder="e.g. Door lock actuator" />}
        <Field label="Amount (CAD)" value={amount} onChange={setAmount} placeholder="275" type="number" />
        <Field label="Vendor / Shop" value={vendor} onChange={setVendor} placeholder="Canadian Tire, Napa Auto..." />
        <Field label="Date" value={date} onChange={setDate} type="date" />
        <Field label="Notes (optional)" value={note} onChange={setNote} placeholder="Used part, set of 4..." />
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
  const [soldDate, setSoldDate]   = useState(today());
  const [hstCollected, setHstCollected] = useState(false);
  const profit = Number(salePrice) - totalCost;
  const margin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const hstAmount = hstCollected ? Number(salePrice) * HST_RATE : 0;

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px" }}>Mark as Sold</h1>
      <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: C.blueLight, borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, color: C.navy }}>{vehicle.year} {vehicle.make} {vehicle.model}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>Total invested: {fmt(totalCost)}</div>
        </div>
        <Field label="Sale Price (CAD)" value={salePrice} onChange={setSalePrice} placeholder="10000" type="number" />
        <Field label="Sale Date" value={soldDate} onChange={setSoldDate} type="date" />

        {/* HST toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.slateLight, borderRadius: 10, padding: "12px 14px" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>HST Collected</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Did you charge HST on this sale?</div>
          </div>
          <button onClick={() => setHstCollected((p) => !p)} style={{ background: hstCollected ? C.green : C.border, border: "none", borderRadius: 20, width: 44, height: 24, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: hstCollected ? 22 : 2, width: 20, height: 20, background: C.white, borderRadius: "50%", transition: "left 0.2s" }} />
          </button>
        </div>
        {hstCollected && Number(salePrice) > 0 && (
          <div style={{ background: C.greenLight, borderRadius: 10, padding: 12, fontSize: 13, color: C.green, fontWeight: 600 }}>
            HST to remit to CRA: {fmtDec(hstAmount)}
          </div>
        )}

        {Number(salePrice) > 0 && (
          <div style={{ background: profit >= 0 ? C.greenLight : C.redLight, border: `1.5px solid ${profit >= 0 ? C.green : C.red}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <ProfitRing margin={margin} size={56} />
            <div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Net Profit</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: profit >= 0 ? C.green : C.red }}>{fmt(profit)}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{margin.toFixed(1)}% margin</div>
            </div>
          </div>
        )}
        <Btn full color={C.green} size="lg" disabled={saving} onClick={() => {
          if (!salePrice) { alert("Enter a sale price."); return; }
          onSave({ salePrice: Number(salePrice), soldDate, hstCollected, hstAmount });
        }}>
          {saving ? "Saving..." : <><Ico name="check" size={20} color={C.white} />Confirm Sale</>}
        </Btn>
      </div>
    </div>
  );
}

// ── Edit Vehicle Form ─────────────────────────────────────────────────────────
function EditVehicleForm({ vehicle: v, onSave, saving }) {
  const [form, setForm] = useState({ year: v.year||"", make: v.make||"", model: v.model||"", trim: v.trim||"", vin: v.vin||"", mileage: String(v.mileage||""), purchaseDate: v.purchaseDate||today(), purchasePrice: String(v.purchasePrice||""), estimatedSale: String(v.estimatedSale||""), status: v.status||"In Repair" });
  const set = (k, val) => setForm((p) => ({ ...p, [k]: val }));
  const models = form.make ? Object.keys(VEHICLE_DB[form.make] || {}).sort() : [];
  const trims  = (form.make && form.model) ? (VEHICLE_DB[form.make]?.[form.model] || []) : [];

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Edit Vehicle</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>{v.year} {v.make} {v.model}</p>
      <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Year"  value={form.year}  options={YEARS} onChange={(val) => set("year", val)} />
        <Select label="Make"  value={form.make}  options={MAKES} onChange={(val) => { set("make", val); set("model", ""); set("trim", ""); }} />
        <Select label="Model" value={form.model} options={models} onChange={(val) => { set("model", val); set("trim", ""); }} />
        <Select label="Trim"  value={form.trim}  options={trims}  onChange={(val) => set("trim", val)} />
        <Field label="VIN"    value={form.vin}   onChange={(val) => set("vin", val)} placeholder="1HGCM82633A123456" />
        <Field label="Mileage (km)"         value={form.mileage}       onChange={(val) => set("mileage", val)}       type="number" />
        <Field label="Purchase Date"        value={form.purchaseDate}   onChange={(val) => set("purchaseDate", val)}   type="date" />
        <Field label="Purchase Price (CAD)" value={form.purchasePrice}  onChange={(val) => set("purchasePrice", val)}  type="number" />
        <Field label="Est. Sale Price (CAD)"value={form.estimatedSale}  onChange={(val) => set("estimatedSale", val)}  type="number" />
        <div>
          <label style={S.label}>Status</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["In Repair","Available","Sold"].map((s) => { const sm = STATUS_META[s]; const active = form.status === s; return <button key={s} onClick={() => set("status", s)} style={{ flex:1, background: active ? sm.bg : C.slateLight, color: active ? sm.color : C.textMuted, border: `2px solid ${active ? sm.color : C.border}`, padding: "10px 6px", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{sm.icon} {s}</button>; })}
          </div>
        </div>
        <Btn full color={C.blue} size="lg" disabled={saving} onClick={() => {
          if (!form.year || !form.make || !form.model || !form.purchasePrice) { alert("Year, Make, Model and Purchase Price are required."); return; }
          onSave({ year: form.year, make: form.make, model: form.model, trim: form.trim, vin: form.vin, mileage: Number(form.mileage)||0, purchaseDate: form.purchaseDate, purchasePrice: Number(form.purchasePrice), estimatedSale: Number(form.estimatedSale)||0, status: form.status });
        }}>
          {saving ? "Saving..." : <><Ico name="check" size={20} color={C.white} />Save Changes</>}
        </Btn>
      </div>
    </div>
  );
}
