import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc, setDoc, getDoc, serverTimestamp
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
  border: "#E3E8F0", teal: "#00ACC1", tealLight: "#E0F7FA",
  orange: "#F4511E", orangeLight: "#FBE9E7",
};

// ── Ontario Copart/IAA Fee Structure ──────────────────────────────────────────
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
  virtualBidFee: 109, gateFee: 79, omvicFee: 22,
  carfaxFee: 39.55, transport: 300, safety: 110,
};
const HST_RATE = 0.13;

function calcAuctionTotal(salePrice) {
  const p = Number(salePrice) || 0;
  const buyerFee = calcBuyerFee(p);
  const subtotal = p + buyerFee + FIXED_FEES.virtualBidFee + FIXED_FEES.gateFee + FIXED_FEES.omvicFee + FIXED_FEES.carfaxFee;
  const hst = Math.round(subtotal * HST_RATE * 100) / 100;
  return { buyerFee, subtotal, hst, totalAuctionCost: subtotal + hst };
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────
const LS_PREFIX = "al_receipt_";
function saveFileLocally(id, dataUrl) {
  try { localStorage.setItem(LS_PREFIX + id, dataUrl); return true; }
  catch (e) { console.warn("LocalStorage full:", e); return false; }
}
function loadFileLocally(id) {
  try { return localStorage.getItem(LS_PREFIX + id); } catch { return null; }
}
function estimateSize(dataUrl) { return Math.round((dataUrl.length * 3) / 4); }
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

// ── Inspection catalogue ──────────────────────────────────────────────────────
const INSPECTION_SECTIONS = [
  { id:"exterior", label:"Exterior body", emoji:"🚗", items:["Hood","Front bumper cover","Front grille","Left front fender","Right front fender","Left front door","Right front door","Left rear door","Right rear door","Left rocker panel","Right rocker panel","Trunk lid / tailgate","Rear bumper cover","Left tail light","Right tail light","Left headlight","Right headlight","Left mirror","Right mirror","Windshield","Rear glass"] },
  { id:"mechanical", label:"Mechanical and engine", emoji:"⚙️", items:["Engine — visual check","Transmission fluid","Oil level and condition","Coolant level","Power steering fluid","Brake fluid","Battery","Alternator / charging","AC compressor","Radiator","Belts and hoses","Exhaust system","Catalytic converter","Fuel system"] },
  { id:"tyres", label:"Tyres and wheels", emoji:"🔵", items:["Front left tyre","Front right tyre","Rear left tyre","Rear right tyre","Left front rim","Right front rim","Left rear rim","Right rear rim","Spare tyre"] },
  { id:"brakes", label:"Brakes and suspension", emoji:"🛑", items:["Front left brake pad","Front right brake pad","Rear left brake pad","Rear right brake pad","Front left rotor","Front right rotor","Rear left rotor","Rear right rotor","Front left strut","Front right strut","Rear left strut","Rear right strut","Control arms","Tie rods"] },
  { id:"interior", label:"Interior", emoji:"🪑", items:["Driver seat","Passenger seat","Rear seats","Dashboard","Centre console","Headliner","Carpet / floor mats","Door panels","Steering wheel","Infotainment screen","Instrument cluster"] },
  { id:"safety", label:"Safety and airbags", emoji:"🛡️", items:["Driver airbag","Passenger airbag","Left curtain airbag","Right curtain airbag","Seat belt — driver","Seat belt — passenger","Seat belt — rear left","Seat belt — rear right","SRS module","ABS system","TPMS sensors","ADAS calibration required"] },
  { id:"electrical", label:"Electrical and lighting", emoji:"⚡", items:["Headlights operation","Tail lights operation","Turn signals","Reverse lights","Interior lights","Power windows","Power locks","Key fob / remote start","OBD scan — check codes","Backup camera","Parking sensors"] },
];

// ── Parts catalogue for enhanced calculator ───────────────────────────────────
const PARTS_CATALOGUE = {
  "Front end": { "Front bumper cover":280,"Hood":420,"Left headlight":260,"Right headlight":260,"Grille assembly":180,"Radiator":320,"Condenser":280,"Front fender L":390,"Front fender R":390,"Radiator support":210 },
  "Rear end": { "Rear bumper cover":240,"Trunk lid":350,"Tailgate":480,"Left tail light":190,"Right tail light":190,"Rear quarter panel L":520,"Rear quarter panel R":520 },
  "Doors and body": { "Front door L":580,"Front door R":580,"Rear door L":540,"Rear door R":540,"Door mirror L":220,"Door mirror R":220,"Rocker panel L":180,"Rocker panel R":180 },
  "Airbags and safety": { "Driver airbag":480,"Passenger airbag":420,"Seat belt L":280,"Seat belt R":280,"SRS module reset":350,"Curtain airbag L":390,"Curtain airbag R":390 },
  "Mechanical": { "Engine assembly":2800,"Transmission":1800,"Catalytic converter":620,"Control module ECU":480,"ADAS calibration":650,"Suspension strut L":310,"Suspension strut R":310 },
};

const LABOR_DEFAULTS = {
  "Front bumper cover":{body:2,paint:2.5},"Hood":{body:1.5,paint:3},"Left headlight":{body:0.5,paint:0},"Right headlight":{body:0.5,paint:0},
  "Front fender L":{body:2,paint:3},"Front fender R":{body:2,paint:3},"Front door L":{body:3,paint:3.5},"Front door R":{body:3,paint:3.5},
  "Rear door L":{body:2.5,paint:3},"Rear door R":{body:2.5,paint:3},"Grille assembly":{body:0.5,paint:0},"Radiator support":{body:3.5,paint:0},
  "Trunk lid":{body:2,paint:2.5},"Tailgate":{body:2.5,paint:3},"Rear bumper cover":{body:1.5,paint:2},
  "Rear quarter panel L":{body:6,paint:4},"Rear quarter panel R":{body:6,paint:4},
  "Driver airbag":{body:1.5,paint:0},"Passenger airbag":{body:2,paint:0},"SRS module reset":{body:1,paint:0},
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-CA", { style:"currency", currency:"CAD", maximumFractionDigits:0 }).format(n || 0);
const fmtDec = (n) => new Intl.NumberFormat("en-CA", { style:"currency", currency:"CAD", minimumFractionDigits:2, maximumFractionDigits:2 }).format(n || 0);
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

function compressImage(dataUrl, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
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

function formatCountdown(target) {
  const diff = target - Date.now();
  if (diff <= 0) return "Sale ended";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
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
    target:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    clock:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    clip:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    list:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  };
  return icons[name] || null;
};

// ── Shared UI ─────────────────────────────────────────────────────────────────
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

// ── AIScanner ─────────────────────────────────────────────────────────────────
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
          <div style={{ color: "#FF8A80", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Scan issue</div>
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
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, marginBottom: 8 }}>Attached ({pendingFiles.length})</div>
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

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function AutoLedger() {
  const [vehicles, setVehicles]     = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [lossLog, setLossLog]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [dbError, setDbError]       = useState(null);
  const [view, setView]             = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [lightbox, setLightbox]     = useState(null);

  const selected = vehicles.find((v) => v.id === selectedId);

  // Vehicles listener
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

  // Deal queue listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "dealQueue"),
      (snap) => setQueueItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.saleTimestamp || 0) - (b.saleTimestamp || 0))),
      (err) => console.error("Queue listener:", err)
    );
    return () => unsub();
  }, []);

  // Loss log listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "lossLog"),
      (snap) => setLossLog(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.loggedAt?.seconds || 0) - (a.loggedAt?.seconds || 0))),
      (err) => console.error("Loss log listener:", err)
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

  // Vehicle CRUD
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

  // Queue CRUD
  async function addQueueItem(data) {
    setSaving(true);
    try { await addDoc(collection(db, "dealQueue"), { ...data, status: "watching", createdAt: serverTimestamp() }); }
    catch { alert("Save failed."); }
    finally { setSaving(false); }
  }

  async function markQueueWon(item) {
    setSaving(true);
    try {
      await updateDoc(doc(db, "dealQueue", item.id), { status: "won", wonAt: serverTimestamp() });
      // Also create a vehicle in inventory
      await addDoc(collection(db, "vehicles"), {
        year: item.year || "", make: item.make || "", model: item.model || "", trim: item.trim || "",
        vin: "", mileage: 0, purchaseDate: today(),
        purchasePrice: Number(item.estimatedBid) || 0,
        estimatedSale: Number(item.marketRetail) || 0,
        expenses: [], status: "In Repair", notes: `Won from ${item.auctionSource || "auction"} — Lot ${item.lotNumber || ""}`,
        createdAt: serverTimestamp(),
      });
    } catch { alert("Save failed."); }
    finally { setSaving(false); }
  }

  async function logLoss(queueId, lossData) {
    setSaving(true);
    try {
      await updateDoc(doc(db, "dealQueue", queueId), { status: "lost" });
      await addDoc(collection(db, "lossLog"), { ...lossData, loggedAt: serverTimestamp() });
    } catch { alert("Save failed."); }
    finally { setSaving(false); }
  }

  // Inspection save
  async function saveInspection(vehicleId, inspectionData) {
    setSaving(true);
    try {
      await setDoc(doc(db, "inspections", vehicleId), { ...inspectionData, updatedAt: serverTimestamp() });
    } catch { alert("Save failed."); }
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
    </div>
  );

  const navTo = (v, id) => { if (id) setSelectedId(id); setView(v); };
  const backView = ["addExpense","sell","docs","editVehicle","notes","inspection"].includes(view) ? "detail" : "list";

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
            {!["dashboard","list","radar","queue"].includes(view) && (
              <button onClick={() => navTo(backView)} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex" }}>
                <Ico name="back" size={20} color={C.white} />
              </button>
            )}
            <div style={{ background: C.amber, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: C.white }}>AL</div>
            <span style={{ fontWeight: 800, fontSize: 16, color: C.white }}>AutoLedger</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
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
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: C.navy, color: C.white, padding: "10px 20px", borderRadius: 24, fontSize: 14, fontWeight: 600, zIndex: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>
          Saving...
        </div>
      )}

      <main style={{ padding: "16px 16px 110px" }}>
        {view === "dashboard"    && <Dashboard stats={stats} vehicles={vehicles} queueItems={queueItems} onSelect={(id) => navTo("detail", id)} onCalc={() => navTo("calculator")} onQueue={() => navTo("queue")} onRadar={() => navTo("radar")} />}
        {view === "list"         && <VehicleList vehicles={vehicles} onSelect={(id) => navTo("detail", id)} onAdd={() => navTo("addVehicle")} />}
        {view === "calculator"   && <DealCalculator />}
        {view === "radar"        && <BidRadar />}
        {view === "queue"        && <DealQueue items={queueItems} lossLog={lossLog} onAdd={addQueueItem} onWon={markQueueWon} onLoss={logLoss} saving={saving} />}
        {view === "detail"       && selected && <VehicleDetail vehicle={selected} onAddExpense={() => navTo("addExpense")} onEdit={() => navTo("editVehicle")} onSell={() => navTo("sell")} onDelete={() => deleteVehicle(selected.id)} onDeleteExpense={(eid) => deleteExpense(selected.id, eid)} onViewDocs={() => navTo("docs")} onViewReceipt={setLightbox} onNotes={() => navTo("notes")} onInspection={() => navTo("inspection")} />}
        {view === "addVehicle"   && <AddVehicleForm onSave={addVehicle} saving={saving} />}
        {view === "editVehicle"  && selected && <EditVehicleForm vehicle={selected} onSave={(d) => editVehicle(selected.id, d)} saving={saving} />}
        {view === "addExpense"   && selected && <AddExpenseForm vehicle={selected} onSave={(exp) => saveExpense(selected.id, exp)} saving={saving} />}
        {view === "sell"         && selected && <SellForm vehicle={selected} onSave={(d) => markSold(selected.id, d)} saving={saving} />}
        {view === "docs"         && selected && <DocumentVault vehicle={selected} onViewReceipt={setLightbox} />}
        {view === "notes"        && selected && <NotesScreen vehicle={selected} onSave={(n) => saveNotes(selected.id, n)} />}
        {view === "inspection"   && selected && <InspectionScreen vehicle={selected} onSave={(d) => saveInspection(selected.id, d)} saving={saving} />}
      </main>

      {/* Bottom nav — 5 tabs */}
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 600, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 env(safe-area-inset-bottom)", zIndex: 100 }}>
        {[
          { id: "dashboard", icon: "chart",  label: "Dashboard" },
          { id: "list",      icon: "car",    label: "Vehicles" },
          { id: "addVehicle",icon: "plus",   label: "Add",    amber: true },
          { id: "radar",     icon: "target", label: "Radar" },
          { id: "queue",     icon: "clock",  label: "Queue" },
        ].map(({ id, icon, label, amber }) => {
          const active = view === id || (id === "list" && ["detail","addExpense","sell","docs","editVehicle","notes","inspection"].includes(view));
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
function Dashboard({ stats, vehicles, queueItems, onSelect, onCalc, onQueue, onRadar }) {
  const soldVehicles = vehicles.filter((v) => v.status === "Sold");
  const avgMargin = soldVehicles.reduce((s, v) => { const { totalCost, profit } = calcVehicle(v); return s + (totalCost > 0 ? (profit / totalCost) * 100 : 0); }, 0) / Math.max(1, soldVehicles.length);
  const bestDeal = soldVehicles.reduce((best, v) => { const { profit } = calcVehicle(v); return profit > (best ? calcVehicle(best).profit : -Infinity) ? v : best; }, null);
  const watchingCount = queueItems.filter(q => q.status === "watching").length;

  // Stale vehicle alert (over 30 days listed)
  const staleVehicles = vehicles.filter(v => {
    if (v.status !== "Available") return false;
    const diff = (Date.now() - (v.createdAt?.seconds || 0) * 1000) / 86400000;
    return diff > 30;
  });

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px", color: C.navy }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Inventory Value", value: fmt(stats.inventory), sub: `${stats.active} active`, accent: C.blue, bg: C.blueLight },
          { label: "Total Invested",  value: fmt(stats.invested),  sub: "all vehicles",           accent: C.navy, bg: "#EDE7F6" },
          { label: "Total Profit",    value: fmt(stats.profit),    sub: `${stats.sold} sold`,      accent: C.green, bg: C.greenLight },
          { label: "Avg Margin",      value: avgMargin.toFixed(1) + "%", sub: "per sold deal",    accent: C.amber, bg: C.amberLight },
        ].map((sc) => (
          <div key={sc.label} style={{ background: sc.bg, borderRadius: 14, padding: "14px 16px", border: `1.5px solid ${sc.accent}22` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: sc.accent, textTransform: "uppercase", letterSpacing: 0.8 }}>{sc.label}</div>
            <div style={{ fontSize: 21, fontWeight: 800, color: sc.accent, margin: "4px 0 2px" }}>{sc.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{sc.sub}</div>
          </div>
        ))}
      </div>

      {/* Stale vehicle alert */}
      {staleVehicles.length > 0 && (
        <div style={{ background: C.amberLight, border: `1.5px solid ${C.amber}44`, borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: C.amber, fontSize: 14 }}>{staleVehicles.length} vehicle{staleVehicles.length > 1 ? "s" : ""} over 30 days listed</div>
            <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>{staleVehicles.map(v => `${v.year} ${v.make} ${v.model}`).join(", ")} — consider adjusting price.</div>
          </div>
        </div>
      )}

      {/* Quick action cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div onClick={onCalc} style={{ ...S.card, padding: "14px 16px", cursor: "pointer", background: `linear-gradient(135deg, ${C.navy}, #283593)`, border: "none" }}>
          <div style={{ background: C.amber, borderRadius: 10, padding: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Ico name="calc" size={20} color={C.white} />
          </div>
          <div style={{ fontWeight: 700, color: C.white, fontSize: 13 }}>Deal Calculator</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Max bid before you bid</div>
        </div>
        <div onClick={onRadar} style={{ ...S.card, padding: "14px 16px", cursor: "pointer", background: `linear-gradient(135deg, ${C.teal}, #006064)`, border: "none" }}>
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Ico name="target" size={20} color={C.white} />
          </div>
          <div style={{ fontWeight: 700, color: C.white, fontSize: 13 }}>Bid Radar</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Scored suggestions</div>
        </div>
      </div>

      {/* Deal Queue summary */}
      <div onClick={onQueue} style={{ ...S.card, padding: "14px 16px", marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: C.amberLight, borderRadius: 10, padding: 8 }}><Ico name="clock" size={20} color={C.amber} /></div>
          <div>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Deal Queue</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{watchingCount} lot{watchingCount !== 1 ? "s" : ""} being watched</div>
          </div>
        </div>
        <Ico name="back" size={18} color={C.textMuted} />
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

// ── Bid Radar ─────────────────────────────────────────────────────────────────
function BidRadar() {
  const [subTab, setSubTab] = useState("suggestions");
  const [filter, setFilter] = useState("all");
  const [watchlist, setWatchlist] = useState([]);
  const [maxBudget, setMaxBudget] = useState("20000");
  const [minProfit, setMinProfit] = useState("3000");

  const SUGGESTIONS = [
    { id:1, title:"2022 Toyota RAV4 XLE AWD", source:"Copart Hamilton", lot:"#44821", saleDays:3, score:92, scoreLabel:"Hot deal", bid:"$12–14k", retail:23500, estProfit:5200, cat:"suv", tags:["Top seller in your history","High Ontario demand","AWD premium"], warns:["Front-end damage — budget repair"] },
    { id:2, title:"2021 Honda Civic Sport Touring", source:"IAA Kitchener", lot:"#38204", saleDays:4, score:88, scoreLabel:"Hot deal", bid:"$9–11k", retail:18900, estProfit:4800, cat:"sedan", tags:["Fast seller — avg 9 days","Low mileage (48k km)"], warns:["Airbag deployed — check harness"] },
    { id:3, title:"2020 Ford F-150 XLT SuperCrew", source:"Copart London", lot:"#51097", saleDays:6, score:81, scoreLabel:"Good deal", bid:"$15–18k", retail:31000, estProfit:6100, cat:"truck", tags:["High-margin truck category"], warns:["Side collision — frame check needed","Higher capital requirement"] },
    { id:4, title:"2019 Toyota Camry SE", source:"IAA Hamilton", lot:"#29441", saleDays:7, score:76, scoreLabel:"Good deal", bid:"$8–10k", retail:16500, estProfit:3800, cat:"sedan", tags:["Proven model in your history","Quick to certify in Ontario"], warns:["Rear-end damage — trunk/bumper"] },
    { id:5, title:"2023 Honda CR-V Sport AWD", source:"IAA London", lot:"#61220", saleDays:9, score:71, scoreLabel:"Consider", bid:"$17–20k", retail:34000, estProfit:7500, cat:"suv", tags:["CR-V your best model"], warns:["High capital tie-up","2023 — check ADAS repair cost"] },
  ];

  const filtered = SUGGESTIONS.filter(s => filter === "all" || s.cat === filter);

  const scoreColor = (s) => s >= 85 ? C.green : s >= 70 ? C.amber : C.slate;
  const scoreBg    = (s) => s >= 85 ? C.greenLight : s >= 70 ? C.amberLight : C.slateLight;

  function addToWatch(s) {
    if (!watchlist.find(w => w.id === s.id)) setWatchlist(p => [...p, s]);
    setSubTab("watchlist");
  }

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Bid Radar</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>Vehicles scored for your Ontario market.</p>

      {/* Sub tabs */}
      <div style={{ display: "flex", background: C.slateLight, borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 }}>
        {[["suggestions","Suggestions"],["watchlist","Watchlist"],["prefs","Preferences"]].map(([id,label]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ flex:1, background: subTab===id ? C.navy : "transparent", color: subTab===id ? C.white : C.slate, border:"none", borderRadius:10, padding:"8px 4px", fontWeight:700, fontSize:12, cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {subTab === "suggestions" && (
        <>
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6, marginBottom:12 }}>
            {[["all","All"],["suv","SUV / Truck"],["sedan","Sedan"],["truck","Truck"]].map(([id,label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ background: filter===id ? C.navy : C.white, color: filter===id ? C.white : C.textMuted, border: `1.5px solid ${filter===id ? C.navy : C.border}`, padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>{label}</button>
            ))}
          </div>
          {filtered.map(s => (
            <div key={s.id} style={{ ...S.card, marginBottom:12 }}>
              <div style={{ padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:C.navy }}>{s.title}</div>
                    <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>{s.source} · Lot {s.lot} · Sale in {s.saleDays}d</div>
                  </div>
                  <div style={{ background:scoreBg(s.score), borderRadius:10, padding:"6px 10px", textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:scoreColor(s.score) }}>{s.score}</div>
                    <div style={{ fontSize:10, color:scoreColor(s.score), fontWeight:600 }}>{s.scoreLabel}</div>
                  </div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                {[["Est. bid",s.bid],["Market retail",fmt(s.retail)],["Est. profit",fmt(s.estProfit)]].map(([l,v],i,arr) => (
                  <div key={l} style={{ padding:"10px 10px", borderRight: i<arr.length-1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ fontSize:10, color:C.textMuted }}>{l}</div>
                    <div style={{ fontSize:13, fontWeight:700, color: l==="Est. profit" ? C.green : C.navy, marginTop:2 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"8px 14px", display:"flex", gap:6, flexWrap:"wrap" }}>
                {s.tags.map(t => <span key={t} style={{ fontSize:10, fontWeight:600, background:C.greenLight, color:C.green, padding:"3px 8px", borderRadius:20 }}>{t}</span>)}
                {s.warns.map(t => <span key={t} style={{ fontSize:10, fontWeight:600, background:C.amberLight, color:C.amber, padding:"3px 8px", borderRadius:20 }}>⚠ {t}</span>)}
              </div>
              <div style={{ display:"flex", gap:8, padding:"10px 14px", borderTop:`1px solid ${C.border}` }}>
                <button onClick={() => addToWatch(s)} style={{ flex:1, background:C.navy, color:C.amber, border:"none", borderRadius:10, padding:"10px 8px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Watch</button>
                <button onClick={() => alert(`Bid strategy for ${s.title}: your max bid at 20% ROI target is approximately ${fmt(Math.round(s.retail * 0.6 / 50) * 50)}. Watch the ${s.warns[0] || "damage"} carefully.`)} style={{ flex:1, background:"transparent", color:C.blue, border:`2px solid ${C.blue}`, borderRadius:10, padding:"10px 8px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Analyse</button>
              </div>
            </div>
          ))}
        </>
      )}

      {subTab === "watchlist" && (
        <>
          {watchlist.length === 0 && (
            <div style={{ ...S.card, padding:"40px 20px", textAlign:"center", color:C.textMuted }}>
              <Ico name="target" size={44} color={C.border} />
              <p style={{ fontWeight:600, marginTop:12 }}>No lots on watchlist</p>
              <p style={{ fontSize:13 }}>Tap Watch on any suggestion to track it here.</p>
            </div>
          )}
          {watchlist.map(s => (
            <div key={s.id} style={{ ...S.card, marginBottom:12 }}>
              <div style={{ padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div><div style={{ fontWeight:700, fontSize:14, color:C.navy }}>{s.title}</div><div style={{ fontSize:12, color:C.textMuted }}>{s.source} · Sale in {s.saleDays}d</div></div>
                  <div style={{ background:scoreBg(s.score), borderRadius:10, padding:"6px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:16, fontWeight:800, color:scoreColor(s.score) }}>{s.score}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:12, marginTop:10 }}>
                  <div><div style={{ fontSize:10, color:C.textMuted }}>Est. bid</div><div style={{ fontWeight:700, color:C.navy }}>{s.bid}</div></div>
                  <div><div style={{ fontSize:10, color:C.textMuted }}>Est. profit</div><div style={{ fontWeight:700, color:C.green }}>{fmt(s.estProfit)}</div></div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, padding:"10px 14px", borderTop:`1px solid ${C.border}` }}>
                <button style={{ flex:1, background:C.navy, color:C.amber, border:"none", borderRadius:10, padding:"10px 8px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Get bid strategy</button>
                <button onClick={() => setWatchlist(p => p.filter(w => w.id !== s.id))} style={{ background:C.redLight, color:C.red, border:`1.5px solid ${C.red}44`, borderRadius:10, padding:"10px 12px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Remove</button>
              </div>
            </div>
          ))}
        </>
      )}

      {subTab === "prefs" && (
        <div style={{ ...S.card, padding:16 }}>
          <p style={S.section}>Your bid preferences</p>
          <Field label="Max bid budget per vehicle (CAD)" value={maxBudget} onChange={setMaxBudget} type="number" placeholder="20000" />
          <div style={{ marginTop:14 }}>
            <Field label="Minimum target profit (CAD)" value={minProfit} onChange={setMinProfit} type="number" placeholder="3000" />
          </div>
          <div style={{ marginTop:16 }}>
            <label style={S.label}>Preferred models to watch</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {["Honda CR-V","Toyota RAV4","Honda Civic","Toyota Camry","Ford F-150","RAM 1500","Dodge Grand Caravan"].map(m => (
                <span key={m} style={{ background:C.blueLight, color:C.blue, padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:600 }}>{m}</span>
              ))}
            </div>
          </div>
          <div style={{ marginTop:16 }}>
            <label style={S.label}>Alert settings</label>
            {[["Score 80+ deal detected","Notify when a hot deal matches your criteria"],["Honda CR-V or RAV4 listed","Your two highest-profit models"],["Sale date within 48 hours","Reminder before watched lots close"]].map(([label,sub]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <div><div style={{ fontWeight:600, fontSize:13, color:C.navy }}>{label}</div><div style={{ fontSize:11, color:C.textMuted }}>{sub}</div></div>
                <div style={{ width:38, height:22, background:C.green, borderRadius:11, position:"relative", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:3, right:3, width:16, height:16, background:C.white, borderRadius:"50%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deal Queue ────────────────────────────────────────────────────────────────
function DealQueue({ items, lossLog, onAdd, onWon, onLoss, saving }) {
  const [subTab, setSubTab] = useState("queue");
  const [showAddForm, setShowAddForm] = useState(false);
  const [lossModal, setLossModal] = useState(null);
  const [lossForm, setLossForm] = useState({ reasons: [], hammer: "", ceiling: "", notes: "" });
  const [lossError, setLossError] = useState("");
  const [tick, setTick] = useState(0);

  // New queue item form
  const [qForm, setQForm] = useState({ make:"", model:"", year:"", trim:"", auctionSource:"Copart Canada", lotNumber:"", saleDate:"", saleTime:"10:00", estimatedBid:"", marketRetail:"", dealScore:"", notes:"" });

  useEffect(() => {
    const t = setInterval(() => setTick(p => p+1), 1000);
    return () => clearInterval(t);
  }, []);

  const watching = items.filter(i => i.status === "watching");
  const won      = items.filter(i => i.status === "won");

  // Loss reasons
  const REASONS = ["Margin too thin","Repair too costly","Too competitive","Missed the sale","Title risk","Changed my mind"];

  function toggleReason(r) {
    setLossForm(p => ({ ...p, reasons: p.reasons.includes(r) ? p.reasons.filter(x => x !== r) : [...p.reasons, r] }));
  }

  async function submitLoss() {
    if (!lossForm.reasons.length) { setLossError("Select at least one reason."); return; }
    await onLoss(lossModal.id, {
      vehicle: `${lossModal.year || ""} ${lossModal.make} ${lossModal.model}`.trim(),
      source: lossModal.auctionSource, lot: lossModal.lotNumber,
      reasons: lossForm.reasons, hammer: Number(lossForm.hammer) || 0,
      ceiling: Number(lossForm.ceiling) || 0, notes: lossForm.notes,
    });
    setLossModal(null);
    setLossForm({ reasons:[], hammer:"", ceiling:"", notes:"" });
    setLossError("");
    setSubTab("lost");
  }

  function getSaleTarget(item) {
    if (!item.saleDate || !item.saleTime) return null;
    return new Date(`${item.saleDate}T${item.saleTime}:00`).getTime();
  }

  const topReason = (() => {
    const counts = {};
    lossLog.forEach(l => (l.reasons || []).forEach(r => { counts[r] = (counts[r] || 0) + 1; }));
    const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
    return top ? top[0] : "None logged";
  })();

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Deal Queue</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>Track live lots, log wins and losses.</p>

      <div style={{ display: "flex", background: C.slateLight, borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 }}>
        {[["queue",`Watching (${watching.length})`],["won",`Won (${won.length})`],["lost",`Loss log (${lossLog.length})`]].map(([id,label]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ flex:1, background: subTab===id ? C.navy : "transparent", color: subTab===id ? C.white : C.slate, border:"none", borderRadius:10, padding:"8px 4px", fontWeight:700, fontSize:11, cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {subTab === "queue" && (
        <>
          <button onClick={() => setShowAddForm(p => !p)} style={{ width:"100%", background:C.navy, color:C.amber, border:"none", borderRadius:12, padding:"13px", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <Ico name="plus" size={18} color={C.amber} />{showAddForm ? "Cancel" : "Add lot to queue"}
          </button>

          {showAddForm && (
            <div style={{ ...S.card, padding:16, marginBottom:14 }}>
              <p style={S.section}>New lot details</p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Field label="Year" value={qForm.year} onChange={v => setQForm(p=>({...p,year:v}))} placeholder="2022" type="number" />
                  <Select label="Make" value={qForm.make} options={MAKES} onChange={v => setQForm(p=>({...p,make:v,model:""}))} />
                </div>
                <Select label="Model" value={qForm.model} options={qForm.make ? Object.keys(VEHICLE_DB[qForm.make]||{}).sort() : []} onChange={v => setQForm(p=>({...p,model:v}))} placeholder={qForm.make ? "Select model..." : "Select make first"} />
                <Select label="Auction source" value={qForm.auctionSource} options={["Copart Canada","IAA Canada"]} onChange={v => setQForm(p=>({...p,auctionSource:v}))} />
                <Field label="Lot number" value={qForm.lotNumber} onChange={v => setQForm(p=>({...p,lotNumber:v}))} placeholder="#44821" />
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Field label="Sale date" value={qForm.saleDate} onChange={v => setQForm(p=>({...p,saleDate:v}))} type="date" />
                  <Field label="Sale time" value={qForm.saleTime} onChange={v => setQForm(p=>({...p,saleTime:v}))} type="time" />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Field label="Est. bid / max bid ($)" value={qForm.estimatedBid} onChange={v => setQForm(p=>({...p,estimatedBid:v}))} placeholder="13000" type="number" />
                  <Field label="Market retail ($)" value={qForm.marketRetail} onChange={v => setQForm(p=>({...p,marketRetail:v}))} placeholder="23000" type="number" />
                </div>
                <Field label="Deal score (0–100)" value={qForm.dealScore} onChange={v => setQForm(p=>({...p,dealScore:v}))} placeholder="88" type="number" />
                <Field label="Notes" value={qForm.notes} onChange={v => setQForm(p=>({...p,notes:v}))} placeholder="Front-end damage, no airbags..." />
                <Btn full color={C.green} onClick={async () => {
                  if (!qForm.make || !qForm.saleDate) { alert("Make and sale date are required."); return; }
                  const saleTimestamp = new Date(`${qForm.saleDate}T${qForm.saleTime||"10:00"}:00`).getTime();
                  await onAdd({ ...qForm, saleTimestamp, estimatedBid: Number(qForm.estimatedBid)||0, marketRetail: Number(qForm.marketRetail)||0, dealScore: Number(qForm.dealScore)||0 });
                  setShowAddForm(false);
                  setQForm({ make:"", model:"", year:"", trim:"", auctionSource:"Copart Canada", lotNumber:"", saleDate:"", saleTime:"10:00", estimatedBid:"", marketRetail:"", dealScore:"", notes:"" });
                }} disabled={saving}>{saving ? "Saving..." : "Add to queue"}</Btn>
              </div>
            </div>
          )}

          {watching.length === 0 && !showAddForm && (
            <div style={{ ...S.card, padding:"40px 20px", textAlign:"center", color:C.textMuted }}>
              <Ico name="clock" size={44} color={C.border} />
              <p style={{ fontWeight:600, marginTop:12 }}>No lots in queue</p>
              <p style={{ fontSize:13 }}>Add a lot before the sale to track it here.</p>
            </div>
          )}

          {watching.sort((a,b) => (b.dealScore||0)-(a.dealScore||0)).map((item, idx) => {
            const target = getSaleTarget(item);
            const cdText = target ? formatCountdown(target) : "No sale time set";
            const urgent = target && (target - Date.now()) < 86400000;
            const scoreColor = (s) => s >= 85 ? C.green : s >= 70 ? C.amber : C.slate;
            const estProfit = item.marketRetail && item.estimatedBid ? item.marketRetail * 0.82 - item.estimatedBid - 2500 : 0;
            return (
              <div key={item.id} style={{ ...S.card, marginBottom:12 }}>
                <div style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <div style={{ background:C.navy, color:C.amber, borderRadius:"50%", width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, flexShrink:0 }}>#{idx+1}</div>
                        <div style={{ fontWeight:700, fontSize:15, color:C.navy }}>{item.year} {item.make} {item.model}</div>
                      </div>
                      <div style={{ fontSize:12, color:C.textMuted }}>{item.auctionSource} · Lot {item.lotNumber}</div>
                    </div>
                    {item.dealScore > 0 && (
                      <div style={{ background:C.blueLight, borderRadius:10, padding:"6px 10px", textAlign:"center", flexShrink:0 }}>
                        <div style={{ fontSize:18, fontWeight:800, color:scoreColor(item.dealScore) }}>{item.dealScore}</div>
                        <div style={{ fontSize:10, color:C.textMuted }}>score</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Countdown bar */}
                <div style={{ background:C.navy, padding:"8px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}><Ico name="clock" size={14} color:"rgba(255,255,255,0.5)" /><span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>Sale in</span></div>
                  <span style={{ fontSize:14, fontWeight:800, color: urgent ? "#FF8A80" : C.amber, fontVariantNumeric:"tabular-nums" }}>{cdText}</span>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderTop:`1px solid ${C.border}` }}>
                  {[["Max bid",fmt(item.estimatedBid)],["Market retail",fmt(item.marketRetail)],["Est. profit",fmt(Math.max(0,estProfit))]].map(([l,v],i,arr) => (
                    <div key={l} style={{ padding:"10px 10px", borderRight: i<arr.length-1 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ fontSize:10, color:C.textMuted }}>{l}</div>
                      <div style={{ fontSize:13, fontWeight:700, color: l==="Est. profit" ? C.green : C.navy, marginTop:2 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {item.notes && <div style={{ padding:"8px 14px", fontSize:12, color:C.textMuted, background:C.bg, borderTop:`1px solid ${C.border}` }}>{item.notes}</div>}

                <div style={{ display:"flex", gap:8, padding:"10px 14px", borderTop:`1px solid ${C.border}` }}>
                  <button onClick={() => onWon(item)} style={{ flex:1, background:C.greenLight, color:C.green, border:`1.5px solid ${C.green}66`, borderRadius:10, padding:"10px 8px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Won ✓</button>
                  <button onClick={() => { setLossModal(item); setLossForm({ reasons:[], hammer:"", ceiling:String(item.estimatedBid||""), notes:"" }); }} style={{ flex:1, background:C.redLight, color:C.red, border:`1.5px solid ${C.red}66`, borderRadius:10, padding:"10px 8px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Lost ✗</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {subTab === "won" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <div style={{ background:C.greenLight, borderRadius:14, padding:"14px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.green, textTransform:"uppercase", letterSpacing:0.8 }}>Lots won</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.green, margin:"4px 0" }}>{won.length}</div>
            </div>
            <div style={{ background:C.blueLight, borderRadius:14, padding:"14px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:0.8 }}>Capital deployed</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.blue, margin:"4px 0" }}>{fmt(won.reduce((s,i) => s + Number(i.estimatedBid||0), 0))}</div>
            </div>
          </div>
          {won.length === 0 && <div style={{ ...S.card, padding:"40px 20px", textAlign:"center", color:C.textMuted }}><p style={{ fontWeight:600 }}>No wins logged yet.</p></div>}
          {won.map(item => (
            <div key={item.id} style={{ ...S.card, marginBottom:10, border:`1.5px solid ${C.green}44`, background:C.greenLight }}>
              <div style={{ padding:"12px 14px" }}>
                <div style={{ fontWeight:700, fontSize:14, color:C.navy }}>{item.year} {item.make} {item.model}</div>
                <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>{item.auctionSource} · Lot {item.lotNumber}</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.green, marginTop:8 }}>Won — added to inventory</div>
                <div style={{ fontSize:12, color:C.textMuted }}>Bid: {fmt(item.estimatedBid)} · Retail: {fmt(item.marketRetail)}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {subTab === "lost" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <div style={{ background:C.redLight, borderRadius:14, padding:"14px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.red, textTransform:"uppercase", letterSpacing:0.8 }}>Lots lost</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.red, margin:"4px 0" }}>{lossLog.length}</div>
            </div>
            <div style={{ background:C.amberLight, borderRadius:14, padding:"14px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.amber, textTransform:"uppercase", letterSpacing:0.8 }}>Top reason</div>
              <div style={{ fontSize:13, fontWeight:800, color:C.amber, margin:"4px 0", lineHeight:1.3 }}>{topReason}</div>
            </div>
          </div>

          {lossLog.length >= 2 && (
            <div style={{ background:C.amberLight, border:`1.5px solid ${C.amber}44`, borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
              <div style={{ fontWeight:700, color:C.amber, fontSize:13, marginBottom:4 }}>💡 Pattern detected</div>
              <div style={{ fontSize:12, color:C.textMid }}>Your most common loss reason is "{topReason}". Review your bid ceiling strategy for affected vehicle types.</div>
            </div>
          )}

          {lossLog.length === 0 && <div style={{ ...S.card, padding:"40px 20px", textAlign:"center", color:C.textMuted }}><p style={{ fontWeight:600 }}>No losses logged yet.</p></div>}
          {lossLog.map(l => {
            const diff = l.hammer && l.ceiling ? l.hammer - l.ceiling : 0;
            return (
              <div key={l.id} style={{ ...S.card, marginBottom:10 }}>
                <div style={{ padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:C.navy }}>{l.vehicle}</div>
                      <div style={{ fontSize:12, color:C.textMuted }}>{l.source}</div>
                    </div>
                    <span style={{ background:C.redLight, color:C.red, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>{(l.reasons||[])[0] || "Unknown"}</span>
                  </div>
                  {l.hammer > 0 && (
                    <div style={{ fontSize:12, color:C.textMuted, marginTop:8 }}>
                      My ceiling: {fmt(l.ceiling)} · Hammer: {fmt(l.hammer)}{diff > 0 ? ` · Missed by ${fmt(diff)}` : ""}
                    </div>
                  )}
                  {l.notes && <div style={{ fontSize:12, color:C.textMid, marginTop:6, fontStyle:"italic" }}>{l.notes}</div>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Loss modal — rendered inline as fixed overlay substitute */}
      {lossModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={() => setLossModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.white, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:600, padding:"20px 16px 40px", maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ width:36, height:4, background:C.border, borderRadius:2, margin:"0 auto 16px" }} />
            <h2 style={{ fontSize:16, fontWeight:800, margin:"0 0 4px" }}>Log auction loss</h2>
            <p style={{ fontSize:13, color:C.textMuted, margin:"0 0 14px" }}>{lossModal.year} {lossModal.make} {lossModal.model}</p>
            <p style={{ fontSize:12, color:C.textMuted, margin:"0 0 10px" }}>What went wrong?</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
              {REASONS.map(r => (
                <button key={r} onClick={() => toggleReason(r)} style={{ padding:"10px 8px", border:`1.5px solid ${lossForm.reasons.includes(r) ? C.red : C.border}`, borderRadius:10, background: lossForm.reasons.includes(r) ? C.redLight : C.white, cursor:"pointer", fontSize:12, fontWeight:600, color: lossForm.reasons.includes(r) ? C.red : C.textMid, textAlign:"center" }}>{r}</button>
              ))}
            </div>
            {lossError && <p style={{ color:C.red, fontSize:12, marginBottom:8 }}>{lossError}</p>}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <Field label="Actual hammer price ($)" value={lossForm.hammer} onChange={v => setLossForm(p=>({...p,hammer:v}))} type="number" placeholder="What did it sell for?" />
              <Field label="Your max bid ceiling ($)" value={lossForm.ceiling} onChange={v => setLossForm(p=>({...p,ceiling:v}))} type="number" placeholder="What were you willing to pay?" />
              <div>
                <label style={S.label}>Notes (what would you do differently?)</label>
                <textarea value={lossForm.notes} onChange={e => setLossForm(p=>({...p,notes:e.target.value}))} style={{ ...S.input, height:72, resize:"none", lineHeight:1.5 }} placeholder="What would you do differently next time?" />
              </div>
              <Btn full color={C.navy} onClick={submitLoss} disabled={saving}>{saving ? "Saving..." : "Save to loss log"}</Btn>
              <Btn full outline color={C.slate} onClick={() => setLossModal(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inspection Screen ─────────────────────────────────────────────────────────
function InspectionScreen({ vehicle: v, onSave, saving }) {
  const [openSections, setOpenSections] = useState({});
  const [itemState, setItemState] = useState({});
  const [customInputs, setCustomInputs] = useState({});
  const [customSevs, setCustomSevs] = useState({});
  const [customItems, setCustomItems] = useState({});
  const [odometer, setOdometer] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [subTab, setSubTab] = useState("inspect");

  function setSev(key, sev) {
    setItemState(p => ({ ...p, [key]: sev }));
  }

  function toggleSection(id) {
    setOpenSections(p => ({ ...p, [id]: !p[id] }));
  }

  function addCustom(secId) {
    const name = (customInputs[secId] || "").trim();
    const sev  = customSevs[secId] || "replace";
    if (!name) return;
    const key = `${secId}|${name}_c_${uid()}`;
    setItemState(p => ({ ...p, [key]: sev }));
    setCustomItems(p => ({ ...p, [secId]: [...(p[secId] || []), { key, name, sev }] }));
    setCustomInputs(p => ({ ...p, [secId]: "" }));
  }

  function getFlagged(secId) {
    return Object.entries(itemState).filter(([k, v]) => k.startsWith(secId + "|") && v !== "none" && v !== undefined).length;
  }

  const allItems = Object.entries(itemState);
  const replaceItems = allItems.filter(([,v]) => v === "replace");
  const repairItems  = allItems.filter(([,v]) => v === "repair");
  const monitorItems = allItems.filter(([,v]) => v === "monitor");

  function getLabel(key) { return key.split("|")[1]?.replace(/_c_[a-z0-9]+$/, "") || key; }

  const SEV_STYLES = {
    ok:      { bg:"#D1FAE5", color:C.green,  label:"OK" },
    monitor: { bg:"#DBEAFE", color:C.blue,   label:"Monitor" },
    repair:  { bg:C.amberLight, color:C.amber, label:"Repair" },
    replace: { bg:C.redLight, color:C.red,   label:"Replace" },
    none:    { bg:C.slateLight, color:C.slate, label:"—" },
  };

  async function handleSave() {
    await onSave({ items: itemState, odometer, assignedTo, targetDate, notes });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{ animation:"slideUp 0.2s ease" }}>
      <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Intake inspection</h1>
      <p style={{ color:C.textMuted, fontSize:14, margin:"0 0 16px" }}>{v.year} {v.make} {v.model}</p>

      <div style={{ display:"flex", background:C.slateLight, borderRadius:12, padding:4, marginBottom:16, gap:4 }}>
        {[["inspect","Inspection"],["summary","Parts summary"],["notes","Notes"]].map(([id,label]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ flex:1, background: subTab===id ? C.navy : "transparent", color: subTab===id ? C.white : C.slate, border:"none", borderRadius:10, padding:"8px 4px", fontWeight:700, fontSize:12, cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {subTab === "inspect" && (
        <>
          <p style={{ ...S.section, marginBottom:8 }}>Tap each item to mark its condition</p>
          {INSPECTION_SECTIONS.map(sec => {
            const flagged = getFlagged(sec.id);
            const isOpen  = openSections[sec.id];
            return (
              <div key={sec.id} style={{ ...S.card, marginBottom:10 }}>
                <div onClick={() => toggleSection(sec.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>{sec.emoji}</span>
                  <span style={{ fontWeight:700, fontSize:14, color:C.navy, flex:1 }}>{sec.label}</span>
                  {flagged > 0 && <span style={{ background:C.amberLight, color:C.amber, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{flagged} flagged</span>}
                  <span style={{ color:C.textMuted, fontSize:18 }}>{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && (
                  <>
                    {sec.items.map(item => {
                      const key = `${sec.id}|${item}`;
                      const curSev = itemState[key] || "none";
                      return (
                        <div key={item} style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:13, color:C.navy, flex:1 }}>{item}</span>
                          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                            {["ok","monitor","repair","replace"].map(sev => {
                              const ss = SEV_STYLES[sev];
                              const active = curSev === sev;
                              return (
                                <button key={sev} onClick={() => setSev(key, active ? "none" : sev)}
                                  style={{ padding:"5px 8px", border:`1.5px solid ${active ? ss.color : C.border}`, borderRadius:8, background: active ? ss.bg : C.white, color: active ? ss.color : C.textMuted, fontSize:11, fontWeight: active ? 700 : 500, cursor:"pointer" }}>
                                  {ss.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {/* Custom items */}
                    {(customItems[sec.id] || []).map(ci => {
                      const curSev = itemState[ci.key] || "none";
                      return (
                        <div key={ci.key} style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8, background:C.bg }}>
                          <span style={{ fontSize:13, color:C.navy, flex:1 }}>{ci.name} <span style={{ fontSize:10, color:C.textMuted }}>(custom)</span></span>
                          <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                            {["ok","monitor","repair","replace"].map(sev => {
                              const ss = SEV_STYLES[sev];
                              const active = curSev === sev;
                              return (
                                <button key={sev} onClick={() => setSev(ci.key, active ? "none" : sev)}
                                  style={{ padding:"5px 8px", border:`1.5px solid ${active ? ss.color : C.border}`, borderRadius:8, background: active ? ss.bg : C.white, color: active ? ss.color : C.textMuted, fontSize:11, fontWeight: active ? 700 : 500, cursor:"pointer" }}>
                                  {ss.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {/* Add custom item */}
                    <div style={{ padding:"8px 14px", borderTop:`1px solid ${C.border}`, background:C.bg, display:"flex", gap:6 }}>
                      <input value={customInputs[sec.id] || ""} onChange={e => setCustomInputs(p=>({...p,[sec.id]:e.target.value}))} placeholder="Add custom item..." style={{ ...S.input, padding:"8px 10px", fontSize:13, flex:1 }} />
                      <select value={customSevs[sec.id] || "replace"} onChange={e => setCustomSevs(p=>({...p,[sec.id]:e.target.value}))} style={{ ...S.input, padding:"8px 10px", fontSize:12, width:"auto" }}>
                        <option value="replace">Replace</option>
                        <option value="repair">Repair</option>
                        <option value="monitor">Monitor</option>
                        <option value="ok">OK</option>
                      </select>
                      <button onClick={() => addCustom(sec.id)} style={{ background:C.blue, color:C.white, border:"none", borderRadius:10, padding:"8px 14px", fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>Add</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <Btn full color={saved ? C.green : C.navy} onClick={handleSave} disabled={saving}>
            {saved ? <><Ico name="check" size={18} color={C.white} />Inspection saved!</> : saving ? "Saving..." : "Save inspection"}
          </Btn>
        </>
      )}

      {subTab === "summary" && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <div style={{ background:C.redLight, borderRadius:14, padding:"14px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.red, textTransform:"uppercase", letterSpacing:0.8 }}>Parts to order</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.red }}>{replaceItems.length}</div>
            </div>
            <div style={{ background:C.amberLight, borderRadius:14, padding:"14px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.amber, textTransform:"uppercase", letterSpacing:0.8 }}>Shop repairs</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.amber }}>{repairItems.length}</div>
            </div>
          </div>

          {replaceItems.length === 0 && repairItems.length === 0 && monitorItems.length === 0 ? (
            <div style={{ ...S.card, padding:"32px 20px", textAlign:"center", color:C.textMuted }}>
              <p>Complete the inspection first to generate the parts summary.</p>
            </div>
          ) : (
            <div style={S.card}>
              {replaceItems.length > 0 && (
                <>
                  <div style={{ padding:"10px 14px", background:C.redLight }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.red, textTransform:"uppercase", letterSpacing:0.7 }}>Parts to order (replace)</span>
                  </div>
                  {replaceItems.map(([k]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 14px", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:13, color:C.navy }}>{getLabel(k)}</span>
                      <span style={{ background:C.redLight, color:C.red, fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>Replace</span>
                    </div>
                  ))}
                </>
              )}
              {repairItems.length > 0 && (
                <>
                  <div style={{ padding:"10px 14px", background:C.amberLight }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.amber, textTransform:"uppercase", letterSpacing:0.7 }}>Shop repairs needed</span>
                  </div>
                  {repairItems.map(([k]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 14px", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:13, color:C.navy }}>{getLabel(k)}</span>
                      <span style={{ background:C.amberLight, color:C.amber, fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>Repair</span>
                    </div>
                  ))}
                </>
              )}
              {monitorItems.length > 0 && (
                <>
                  <div style={{ padding:"10px 14px", background:C.blueLight }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.blue, textTransform:"uppercase", letterSpacing:0.7 }}>Monitor during repair</span>
                  </div>
                  {monitorItems.map(([k]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 14px", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:13, color:C.navy }}>{getLabel(k)}</span>
                      <span style={{ background:C.blueLight, color:C.blue, fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>Monitor</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {subTab === "notes" && (
        <div style={{ ...S.card, padding:16, display:"flex", flexDirection:"column", gap:14 }}>
          <Field label="Odometer on arrival (km)" value={odometer} onChange={setOdometer} type="number" placeholder="87420" />
          <Field label="Assigned to (tech or shop)" value={assignedTo} onChange={setAssignedTo} placeholder="Shop name or technician" />
          <Field label="Target completion date" value={targetDate} onChange={setTargetDate} type="date" />
          <div>
            <label style={S.label}>Inspector notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...S.input, height:120, resize:"none", lineHeight:1.5 }} placeholder="Overall condition, concerns, anything the tech should know before starting work..." />
          </div>
          <Btn full color={saved ? C.green : C.navy} onClick={handleSave} disabled={saving}>
            {saved ? "Saved!" : saving ? "Saving..." : "Save notes"}
          </Btn>
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
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Ico name="search" size={17} color={C.textMuted} /></div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search make, model, year, VIN..."
          style={{ ...S.input, paddingLeft: 38, fontSize: 14 }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {["All", "In Repair", "Available", "Sold"].map((t) => {
          const sm = STATUS_META[t];
          const active = filter === t;
          return <button key={t} onClick={() => setFilter(t)} style={{ background: active ? (sm ? sm.bg : C.blueLight) : C.white, color: active ? (sm ? sm.color : C.blue) : C.textMuted, border: `1.5px solid ${active ? (sm ? sm.color : C.blue) : C.border}`, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{t} {filter === t && `(${filtered.length})`}</button>;
        })}
      </div>
      {filtered.length === 0 && <div style={{ ...S.card, padding: 40, textAlign: "center", color: C.textMuted }}><div style={{ fontSize: 44 }}>🔍</div><p style={{ fontWeight: 600 }}>{search ? "No matches found" : "No vehicles here"}</p></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((v) => <VehicleCard key={v.id} v={v} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

// ── Vehicle Detail ────────────────────────────────────────────────────────────
function VehicleDetail({ vehicle: v, onAddExpense, onEdit, onSell, onDelete, onDeleteExpense, onViewDocs, onViewReceipt, onNotes, onInspection }) {
  const { totalExpenses, totalCost, profit, margin } = calcVehicle(v);
  const sm = STATUS_META[v.status] || STATUS_META["In Repair"];
  const receipts = allReceipts(v);
  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
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

      {/* Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {v.status !== "Sold" && <>
          <Btn full color={C.blue} onClick={onAddExpense}><Ico name="plus" size={17} color={C.white} />Add Expense</Btn>
          <Btn full color={C.green} onClick={onSell}><Ico name="dollar" size={17} color={C.white} />Mark Sold</Btn>
        </>}
        <Btn full outline color={C.blue} onClick={onEdit}><Ico name="edit" size={16} color={C.blue} />Edit</Btn>
        <Btn full outline color={C.slate} onClick={onNotes}><Ico name="note" size={16} color={C.slate} />Notes{v.notes ? " ●" : ""}</Btn>
        {v.status !== "Sold" && (
          <div style={{ gridColumn:"1 / -1" }}>
            <Btn full color={C.orange} onClick={onInspection}><Ico name="clip" size={16} color={C.white} />Intake Inspection</Btn>
          </div>
        )}
      </div>

      {receipts.length > 0 && (
        <div onClick={onViewDocs} style={{ ...S.card, padding: "14px 16px", marginBottom: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: C.blueLight, borderRadius: 10, padding: 8 }}><Ico name="folder" size={20} color={C.blue} /></div>
            <div><div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Document Vault</div><div style={{ fontSize: 12, color: C.textMuted }}>{receipts.length} receipt{receipts.length !== 1 ? "s" : ""}</div></div>
          </div>
          <Ico name="back" size={18} color={C.textMuted} />
        </div>
      )}

      {v.notes && (
        <div style={{ ...S.card, padding: "14px 16px", marginBottom: 14, background: C.amberLight, border: `1.5px solid ${C.amber}33` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.5 }}>{v.notes}</div>
        </div>
      )}

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
                          const src = r.isPdf ? (r.localId ? loadFileLocally(r.localId) : null) : r.dataUrl;
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

// ── Deal Calculator (Enhanced) ────────────────────────────────────────────────
function DealCalculator() {
  const [calcTab, setCalcTab] = useState("bid");
  const [hammerprice, setHammerprice]   = useState("");
  const [repairs, setRepairs]           = useState("");
  const [partsTotal, setPartsTotal]     = useState(0);
  const [laborTotal, setLaborTotal]     = useState(0);
  const [targetSale, setTargetSale]     = useState("");
  const [targetROI, setTargetROI]       = useState("20");
  const [transport, setTransport]       = useState(String(FIXED_FEES.transport));
  const [safety, setSafety]             = useState(String(FIXED_FEES.safety));
  const [exitStrategy, setExitStrategy] = useState("retail");
  const [disclosures, setDisclosures]   = useState([]);
  const [selectedParts, setSelectedParts] = useState({});
  const [laborLines, setLaborLines]     = useState({});
  const [bodyRate, setBodyRate]         = useState("75");
  const [paintRate, setPaintRate]       = useState("65");
  const [extraOps, setExtraOps]         = useState({});
  const [openCats, setOpenCats]         = useState({});

  const DISCLOSURES = [
    { id:"airbag",     label:"Airbags deployed",    retail:-7,  wholesale:-4 },
    { id:"structural", label:"Structural damage",   retail:-8,  wholesale:-4 },
    { id:"engine",     label:"Engine issues",       retail:-12, wholesale:-8 },
    { id:"totalloss",  label:"Total loss history",  retail:-7,  wholesale:-3 },
    { id:"multiacc",   label:"Multiple accidents",  retail:-5,  wholesale:-2 },
  ];

  const EXTRA_OPS = [
    { id:"adas",   label:"ADAS recalibration",      cost:650 },
    { id:"frame",  label:"Frame pull and alignment", cost:480 },
    { id:"diag",   label:"Diagnostic scan",          cost:180 },
    { id:"detail", label:"Full detail and prep",     cost:220 },
    { id:"cert",   label:"Ontario safety certificate",cost:150 },
  ];

  const p     = Number(hammerprice) || 0;
  const sale  = Number(targetSale)  || 0;
  const trans = Number(transport)   || 0;
  const saf   = Number(safety)      || 0;
  const roi   = Number(targetROI)   || 20;

  const discAdj = disclosures.reduce((s, id) => {
    const d = DISCLOSURES.find(x => x.id === id);
    return s + (d ? (exitStrategy === "retail" ? d.retail : d.wholesale) : 0);
  }, 0);

  const adjSell = exitStrategy === "retail"
    ? sale * (1 + discAdj / 100)
    : sale * 0.8 * (1 + discAdj / 100);

  const totalRepairCost = partsTotal + laborTotal + (Number(repairs) || 0);
  const { buyerFee, hst, totalAuctionCost } = calcAuctionTotal(p);
  const fixedCosts = totalAuctionCost + totalRepairCost + trans + saf;
  const totalCost  = fixedCosts; // hammer already in auction total
  const profit     = adjSell > 0 ? adjSell - (p + fixedCosts - totalAuctionCost + totalAuctionCost) : 0;
  // Simplified: profit = adjSell - (hammer + buyerFee + hst + virtualBid + gate + omvic + carfax + repairs + parts + labor + transport + safety)
  const allCosts = p + buyerFee + hst + FIXED_FEES.virtualBidFee + FIXED_FEES.gateFee + FIXED_FEES.omvicFee + FIXED_FEES.carfaxFee + totalRepairCost + trans + saf;
  const realProfit = adjSell > 0 ? adjSell - allCosts : 0;
  const realROI    = allCosts > 0 && adjSell > 0 ? (realProfit / allCosts) * 100 : 0;

  const maxBid = adjSell > 0 ? (() => {
    const fc = FIXED_FEES.virtualBidFee + FIXED_FEES.gateFee + FIXED_FEES.omvicFee + FIXED_FEES.carfaxFee + totalRepairCost + trans + saf;
    let lo = 0, hi = adjSell;
    for (let i = 0; i < 60; i++) {
      const guess = (lo + hi) / 2;
      const { totalAuctionCost: tac } = calcAuctionTotal(guess);
      const totalC = tac + fc;
      const pr = adjSell - totalC;
      if (totalC > 0 && (pr / totalC) * 100 > roi) lo = guess; else hi = guess;
    }
    return Math.floor(lo / 50) * 50;
  })() : 0;

  const verdict = !p ? null : realProfit > 0 && realROI >= 20 ? "go" : realROI >= 10 ? "caution" : "pass";
  const verdictStyle = {
    go:      { bg: C.greenLight, color: C.green, icon: "✅", text: "Good deal — go for it" },
    caution: { bg: C.amberLight, color: C.amber, icon: "⚠️", text: "Thin margin — proceed carefully" },
    pass:    { bg: C.redLight,   color: C.red,   icon: "🚫", text: "Low margin — consider passing" },
  };

  // Parts helpers
  function togglePart(name, price) {
    setSelectedParts(p => {
      const next = { ...p };
      if (next[name]) { delete next[name]; }
      else { next[name] = price; }
      const total = Object.values(next).reduce((s,v) => s+v, 0);
      setPartsTotal(total);
      // Update labor lines
      const def = LABOR_DEFAULTS[name] || { body:1, paint:1 };
      if (!next[name]) {
        setLaborLines(ll => { const n = {...ll}; delete n[name]; return n; });
      } else {
        setLaborLines(ll => ({ ...ll, [name]: ll[name] || def }));
      }
      return next;
    });
  }

  function recalcLabor() {
    const br = Number(bodyRate) || 75;
    const pr = Number(paintRate) || 65;
    const linesTotal = Object.entries(laborLines).reduce((s,[,l]) => s + (l.body||0)*br + (l.paint||0)*pr, 0);
    const opsTotal = Object.values(extraOps).reduce((s,c) => s+c, 0);
    setLaborTotal(Math.round(linesTotal + opsTotal));
  }

  useEffect(() => { recalcLabor(); }, [laborLines, bodyRate, paintRate, extraOps]);

  function toggleExtraOp(op) {
    setExtraOps(p => {
      const n = { ...p };
      if (n[op.id]) delete n[op.id]; else n[op.id] = op.cost;
      return n;
    });
  }

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Deal Calculator</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>Ontario fees, parts, labor, and ROI targets built in.</p>

      {/* Calculator tabs */}
      <div style={{ display:"flex", background:C.slateLight, borderRadius:12, padding:4, marginBottom:16, gap:4 }}>
        {[["bid","Bid engine"],["parts","Parts"],["labor","Labor"]].map(([id,label]) => (
          <button key={id} onClick={() => setCalcTab(id)} style={{ flex:1, background: calcTab===id ? C.navy : "transparent", color: calcTab===id ? C.white : C.slate, border:"none", borderRadius:10, padding:"8px 4px", fontWeight:700, fontSize:12, cursor:"pointer" }}>{label}</button>
        ))}
      </div>

      {calcTab === "bid" && (
        <>
          <div style={{ ...S.card, padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ ...S.section, margin: 0 }}>Auction details</p>
            <Field label="Hammer / auction price (CAD)" value={hammerprice} onChange={setHammerprice} placeholder="9000" type="number" />
            <Field label="Market retail value (CAD)" value={targetSale} onChange={setTargetSale} placeholder="17500" type="number" />

            {p > 0 && (
              <div style={{ background: C.blueLight, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.7 }}>Copart / IAA fees (Ontario)</div>
                {[["Buyer fee", buyerFee],["Virtual bid fee", FIXED_FEES.virtualBidFee],["Gate fee", FIXED_FEES.gateFee],["OMVIC fee", FIXED_FEES.omvicFee],["CarFax fee", FIXED_FEES.carfaxFee],["HST (13%)", hst]].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: C.textMid }}>{label}</span>
                    <span style={{ fontWeight: 600, color: C.navy }}>{fmtDec(val)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 4 }}>
                  <span>Total auction cost</span><span style={{ color: C.blue }}>{fmt(totalAuctionCost)}</span>
                </div>
              </div>
            )}

            <p style={{ ...S.section, margin: 0 }}>Buyer disclosure adjustments</p>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {DISCLOSURES.map(d => {
                const on = disclosures.includes(d.id);
                return (
                  <button key={d.id} onClick={() => setDisclosures(p => on ? p.filter(x=>x!==d.id) : [...p,d.id])}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", border:`1.5px solid ${on ? C.red : C.border}`, borderRadius:10, background: on ? C.redLight : C.white, cursor:"pointer", textAlign:"left" }}>
                    <span style={{ fontSize:13, fontWeight:600, color: on ? C.red : C.textMid }}>{d.label}</span>
                    <span style={{ fontSize:12, color: on ? C.red : C.textMuted }}>Retail {d.retail}% / Wholesale {d.wholesale}%</span>
                  </button>
                );
              })}
            </div>
            {disclosures.length > 0 && (
              <div style={{ background:C.redLight, borderRadius:10, padding:10, fontSize:12, color:C.red, fontWeight:600 }}>
                Total adj: {discAdj.toFixed(0)}% on {exitStrategy} price → Adjusted sell: {fmt(adjSell)}
              </div>
            )}

            <p style={{ ...S.section, margin: 0 }}>Exit strategy</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[["retail","Retail","Facebook / private buyer"],["wholesale","Wholesale","Dealer / auction flip"]].map(([id,label,sub]) => (
                <button key={id} onClick={() => setExitStrategy(id)} style={{ padding:"12px 10px", border:`2px solid ${exitStrategy===id ? C.navy : C.border}`, borderRadius:12, background: exitStrategy===id ? C.blueLight : C.white, cursor:"pointer" }}>
                  <div style={{ fontWeight:700, fontSize:13, color: exitStrategy===id ? C.navy : C.textMid }}>{label}</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{sub}</div>
                </button>
              ))}
            </div>

            <p style={{ ...S.section, margin: 0 }}>Target ROI</p>
            <div style={{ display:"flex", gap:6 }}>
              {["20","30","40","50"].map(r => (
                <button key={r} onClick={() => setTargetROI(r)} style={{ flex:1, padding:"10px 4px", border:`2px solid ${targetROI===r ? C.navy : C.border}`, borderRadius:10, background: targetROI===r ? C.navy : C.white, color: targetROI===r ? C.amber : C.textMuted, fontWeight:700, fontSize:13, cursor:"pointer" }}>{r}%</button>
              ))}
            </div>

            <p style={{ ...S.section, margin: 0 }}>Additional costs</p>
            <Field label="Transport (CAD)" value={transport} onChange={setTransport} placeholder="300" type="number" />
            <Field label="Safety certificate (CAD)" value={safety} onChange={setSafety} placeholder="110" type="number" />
            {(partsTotal > 0 || laborTotal > 0) && (
              <div style={{ background:C.blueLight, borderRadius:10, padding:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                  <span style={{ color:C.textMid }}>Parts (from Parts tab)</span>
                  <span style={{ fontWeight:700, color:C.navy }}>{fmt(partsTotal)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                  <span style={{ color:C.textMid }}>Labor (from Labor tab)</span>
                  <span style={{ fontWeight:700, color:C.navy }}>{fmt(laborTotal)}</span>
                </div>
              </div>
            )}
            <Field label="Additional repairs not in Parts/Labor (CAD)" value={repairs} onChange={setRepairs} placeholder="500" type="number" />
          </div>

          {/* Results */}
          {(p > 0 || adjSell > 0) && (
            <div style={{ ...S.card, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ background: C.navy, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Deal summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                  {[
                    { label: "All-in cost", value: fmt(allCosts) },
                    { label: "Net profit", value: fmt(realProfit), color: realProfit >= 0 ? "#69F0AE" : "#FF5252" },
                    { label: "ROI", value: realROI.toFixed(1) + "%", color: realROI >= 20 ? "#69F0AE" : realROI >= 10 ? C.amber : "#FF5252" },
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
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Max bid for {targetROI}% ROI ({exitStrategy})</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.amber }}>{fmt(maxBid)}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Do not bid above this to hit your target</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {calcTab === "parts" && (
        <>
          <div style={{ background:C.slateLight, borderRadius:12, padding:"12px 14px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontWeight:700, color:C.navy }}>Parts total</span>
            <span style={{ fontWeight:800, fontSize:20, color: partsTotal > 0 ? C.red : C.textMuted }}>{fmt(partsTotal)}</span>
          </div>
          {Object.entries(PARTS_CATALOGUE).map(([cat, parts]) => (
            <div key={cat} style={{ ...S.card, marginBottom:10 }}>
              <div onClick={() => setOpenCats(p => ({...p,[cat]:!p[cat]}))} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", cursor:"pointer" }}>
                <span style={{ fontWeight:700, fontSize:14, color:C.navy }}>{cat}</span>
                <span style={{ color:C.textMuted }}>{openCats[cat] ? "▲" : "▼"}</span>
              </div>
              {openCats[cat] && (
                <div style={{ borderTop:`1px solid ${C.border}` }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:12 }}>
                    {Object.entries(parts).map(([name, price]) => {
                      const on = !!selectedParts[name];
                      return (
                        <button key={name} onClick={() => togglePart(name, price)}
                          style={{ padding:"10px 8px", border:`1.5px solid ${on ? C.blue : C.border}`, borderRadius:10, background: on ? C.blueLight : C.white, cursor:"pointer", textAlign:"center" }}>
                          <div style={{ fontSize:12, fontWeight:600, color: on ? C.blue : C.textMid }}>{name}</div>
                          <div style={{ fontSize:11, color: on ? C.blue : C.textMuted, marginTop:2 }}>{fmt(price)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          {Object.keys(selectedParts).length > 0 && (
            <>
              <p style={S.section}>Selected parts</p>
              <div style={S.card}>
                {Object.entries(selectedParts).map(([name, price]) => (
                  <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 14px", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:13, color:C.navy }}>{name}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontWeight:700, color:C.navy }}>{fmt(price)}</span>
                      <button onClick={() => togglePart(name, price)} style={{ background:C.redLight, border:"none", borderRadius:8, padding:"5px 8px", cursor:"pointer" }}><Ico name="x" size={14} color={C.red} /></button>
                    </div>
                  </div>
                ))}
                <div style={{ padding:"12px 14px", background:C.slateLight, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontWeight:700 }}>Total</span>
                  <span style={{ fontWeight:800, color:C.red }}>{fmt(partsTotal)}</span>
                </div>
              </div>
              <div style={{ marginTop:10 }}>
                <Btn full color={C.navy} onClick={() => setCalcTab("bid")}>Apply to bid engine →</Btn>
              </div>
            </>
          )}
        </>
      )}

      {calcTab === "labor" && (
        <>
          <div style={{ ...S.card, padding:16, marginBottom:14 }}>
            <p style={{ ...S.section, margin:"0 0 10px" }}>Labor rates</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="Body rate ($/hr)" value={bodyRate} onChange={setBodyRate} type="number" placeholder="75" />
              <Field label="Paint rate ($/hr)" value={paintRate} onChange={setPaintRate} type="number" placeholder="65" />
            </div>
          </div>

          {Object.keys(laborLines).length > 0 ? (
            <div style={{ ...S.card, marginBottom:14 }}>
              <div style={{ padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr 60px 60px 60px", gap:6 }}>
                <span style={{ fontSize:11, fontWeight:700, color:C.textMuted }}>Part</span>
                <span style={{ fontSize:11, fontWeight:700, color:C.textMuted, textAlign:"center" }}>Body hrs</span>
                <span style={{ fontSize:11, fontWeight:700, color:C.textMuted, textAlign:"center" }}>Paint hrs</span>
                <span style={{ fontSize:11, fontWeight:700, color:C.textMuted, textAlign:"right" }}>Cost</span>
              </div>
              {Object.entries(laborLines).map(([name, line]) => {
                const br = Number(bodyRate) || 75;
                const pr = Number(paintRate) || 65;
                const cost = (line.body || 0) * br + (line.paint || 0) * pr;
                return (
                  <div key={name} style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}`, display:"grid", gridTemplateColumns:"1fr 60px 60px 60px", gap:6, alignItems:"center" }}>
                    <span style={{ fontSize:12, color:C.navy }}>{name}</span>
                    <input type="number" step="0.5" value={line.body} onChange={e => setLaborLines(p => ({...p,[name]:{...p[name],body:Number(e.target.value)||0}}))} style={{ ...S.input, padding:"6px 4px", fontSize:12, textAlign:"center" }} />
                    <input type="number" step="0.5" value={line.paint} onChange={e => setLaborLines(p => ({...p,[name]:{...p[name],paint:Number(e.target.value)||0}}))} style={{ ...S.input, padding:"6px 4px", fontSize:12, textAlign:"center" }} />
                    <span style={{ fontSize:12, fontWeight:700, color:C.navy, textAlign:"right" }}>{fmt(cost)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ ...S.card, padding:"28px 20px", textAlign:"center", color:C.textMuted, marginBottom:14 }}>
              <p>Select parts in the Parts tab to auto-generate labor lines here.</p>
            </div>
          )}

          <p style={S.section}>Additional operations</p>
          <div style={{ ...S.card, marginBottom:14 }}>
            {EXTRA_OPS.map(op => {
              const on = !!extraOps[op.id];
              return (
                <button key={op.id} onClick={() => toggleExtraOp(op)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"12px 14px", border:"none", borderBottom:`1px solid ${C.border}`, background: on ? C.greenLight : C.white, cursor:"pointer", textAlign:"left" }}>
                  <span style={{ fontSize:13, fontWeight:600, color: on ? C.green : C.textMid }}>{op.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color: on ? C.green : C.textMuted }}>+{fmt(op.cost)}</span>
                </button>
              );
            })}
          </div>

          <div style={{ background:C.slateLight, borderRadius:12, padding:"12px 14px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontWeight:700, color:C.navy }}>Total labor cost</span>
            <span style={{ fontWeight:800, fontSize:20, color: laborTotal > 0 ? C.red : C.textMuted }}>{fmt(laborTotal)}</span>
          </div>
          <Btn full color={C.navy} onClick={() => setCalcTab("bid")}>Apply to bid engine →</Btn>
        </>
      )}
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
        <label style={S.label}>Vehicle notes</label>
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
            <Btn full color={C.blue} onClick={() => receipts.forEach((r, i) => setTimeout(() => { if (r.dataUrl) downloadDataUrl(r.dataUrl, r.name || `receipt-${i + 1}`); }, i * 200))}>
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
                    onViewReceipt({ dataUrl: src, name: filename, isPdf: r.isPdf });
                  }} style={{ width: 56, height: 56, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.slateLight, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isPdf ? <div style={{ textAlign: "center" }}><Ico name="file" size={20} color={C.amber} /><div style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>PDF</div></div>
                      : <img src={r.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="receipt" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.expenseItem}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{r.expenseVendor || "—"} · {r.expenseDate}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{isPdf ? "PDF" : "Image"} · {filename}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => {
                      const src = r.isPdf ? (r.localId ? loadFileLocally(r.localId) : null) : r.dataUrl;
                      onViewReceipt({ dataUrl: src, name: filename, isPdf: r.isPdf });
                    }} style={{ background: C.blueLight, border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}><Ico name="eye" size={17} color={C.blue} /></button>
                    <button onClick={() => {
                      const src = r.isPdf ? (r.localId ? loadFileLocally(r.localId) : null) : r.dataUrl;
                      if (!src) { alert("File not available."); return; }
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
  const [form, setForm] = useState({ year:"", make:"", model:"", trim:"", vin:"", mileage:"", purchaseDate:today(), purchasePrice:"", estimatedSale:"" });
  const [scanning, setScanning]     = useState(false);
  const [scanError, setScanError]   = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanDoc, setScanDoc]       = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const models = form.make ? Object.keys(VEHICLE_DB[form.make] || {}).sort() : [];
  const trims  = (form.make && form.model) ? (VEHICLE_DB[form.make]?.[form.model] || []) : [];

  function matchMake(raw) { if (!raw) return ""; const u = raw.toUpperCase(); return MAKES.find((m) => u.includes(m.toUpperCase())) || ""; }
  function matchModel(make, raw) { if (!make || !raw) return ""; const u = raw.toUpperCase(); return Object.keys(VEHICLE_DB[make] || {}).find((m) => u.includes(m.toUpperCase())) || ""; }
  function matchTrim(make, model, raw) { if (!make || !model || !raw) return ""; const u = raw.toUpperCase(); return (VEHICLE_DB[make]?.[model] || []).find((t) => u.includes(t.toUpperCase())) || ""; }

  async function scanDocument(file) {
    setScanning(true); setScanError(""); setScanResult(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const base64  = dataUrl.split(",")[1];
      const isPdf   = file.type === "application/pdf";
      setScanDoc({ dataUrl, name: file.name || (isPdf ? "document.pdf" : "document.jpg") });
      const contentBlock = isPdf
        ? { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64 } }
        : { type:"image",    source:{ type:"base64", media_type:file.type||"image/jpeg", data:base64 } };
      const resp = await fetch("/api/scan", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000,
          messages:[{ role:"user", content:[contentBlock, { type:"text", text:`Extract vehicle purchase details. Return ONLY valid JSON:\n{"year":"4-digit year","make":"manufacturer","model":"model name","trim":"trim or empty","vin":"17-char VIN or empty","mileage":"digits only or empty","purchaseDate":"YYYY-MM-DD or empty","purchasePrice":number or 0,"vendor":"seller name"}` }] }] }),
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const data  = await resp.json();
      const text  = (data.content || []).map((b) => b.text || "").join("").trim();
      const clean = text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim();
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
      setScanResult({ summary:`Auto-filled ${filled.length} field${filled.length !== 1 ? "s" : ""}`, details:filled.join(", ") });
      if (filled.length === 0) setScanError("No vehicle details found. Fill in manually.");
    } catch (e) {
      setScanError(e.message || "Could not read document.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 16px" }}>Add Vehicle</h1>
      <AIScanner title="AI Document Scanner" description="Upload your Copart/IAA bill of sale — AI reads it and fills the form automatically."
        onFile={scanDocument} scanning={scanning} scanError={scanError} scanResult={scanResult} onApply={() => setScanResult(null)}
        pendingFiles={scanDoc ? [scanDoc] : []} />
      <div style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Year"  value={form.year}  options={YEARS} onChange={(v) => set("year", v)} placeholder="Select year..." />
        <Select label="Make"  value={form.make}  options={MAKES} onChange={(v) => { set("make", v); set("model", ""); set("trim", ""); }} placeholder="Select make..." />
        <Select label="Model" value={form.model} options={models} onChange={(v) => { set("model", v); set("trim", ""); }} placeholder={form.make ? "Select model..." : "Select make first"} />
        <Select label="Trim"  value={form.trim}  options={trims}  onChange={(v) => set("trim", v)} placeholder={trims.length ? "Select trim..." : "Select model first"} />
        <Field label="VIN" value={form.vin} onChange={(v) => set("vin", v)} placeholder="1HGCM82633A123456" />
        <Field label="Mileage (km)" value={form.mileage} onChange={(v) => set("mileage", v)} placeholder="142000" type="number" />
        <Field label="Purchase Date" value={form.purchaseDate} onChange={(v) => set("purchaseDate", v)} type="date" />
        <Field label="Purchase Price (CAD)" value={String(form.purchasePrice)} onChange={(v) => set("purchasePrice", v)} placeholder="5400" type="number" />
        <Field label="Estimated Sale Price (CAD)" value={String(form.estimatedSale)} onChange={(v) => set("estimatedSale", v)} placeholder="10000" type="number" />
        <Btn full color={C.blue} size="lg" disabled={saving} onClick={() => {
          if (!form.year || !form.make || !form.model || !form.purchasePrice) { alert("Year, Make, Model and Purchase Price are required."); return; }
          onSave({ ...form, purchasePrice:Number(form.purchasePrice), mileage:Number(form.mileage)||0, estimatedSale:Number(form.estimatedSale)||0 });
        }}>
          {saving ? "Saving..." : <><Ico name="plus" size={20} color={C.white} />Add Vehicle</>}
        </Btn>
      </div>
    </div>
  );
}

// ── Add Expense Form ──────────────────────────────────────────────────────────
function AddExpenseForm({ vehicle, onSave, saving }) {
  const [category, setCategory]     = useState("Mechanical");
  const [item, setItem]             = useState("Battery");
  const [customItem, setCustomItem] = useState("");
  const [amount, setAmount]         = useState("");
  const [vendor, setVendor]         = useState("");
  const [date, setDate]             = useState(today());
  const [note, setNote]             = useState("");
  const [receipts, setReceipts]     = useState([]);
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanRaw, setScanRaw]       = useState(null);
  const [scanError, setScanError]   = useState("");

  const items    = EXPENSE_CATEGORIES[category] || [];
  const isCustom = item === "Custom...";
  const cc       = CAT_COLORS[category] || CAT_COLORS.Other;

  async function processFile(file) {
    setScanning(true); setScanError(""); setScanResult(null); setScanRaw(null);
    try {
      const dataUrl   = await fileToDataUrl(file);
      const isPdf     = file.type === "application/pdf";
      const mediaType = isPdf ? "application/pdf" : "image/jpeg";
      const fileName  = file.name || (isPdf ? "receipt.pdf" : "receipt.jpg");
      const base64ForScan = dataUrl.split(",")[1];

      let storedDataUrl;
      let localId = null;
      if (isPdf) {
        localId = uid();
        saveFileLocally(localId, dataUrl);
        storedDataUrl = null;
      } else {
        let compressed = await compressImage(dataUrl, 800, 0.7);
        if (estimateSize(compressed) > MAX_FIRESTORE_RECEIPT) compressed = await compressImage(dataUrl, 600, 0.5);
        if (estimateSize(compressed) > MAX_FIRESTORE_RECEIPT) compressed = await compressImage(dataUrl, 400, 0.4);
        storedDataUrl = compressed;
      }

      setReceipts((prev) => [...prev, { dataUrl: isPdf ? dataUrl : storedDataUrl, firestoreDataUrl: storedDataUrl, localId, name: fileName, type: mediaType, isPdf }]);

      const contentBlock = isPdf
        ? { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64ForScan } }
        : { type:"image",    source:{ type:"base64", media_type:mediaType,        data:base64ForScan } };

      const resp = await fetch("/api/scan", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000,
          messages:[{ role:"user", content:[contentBlock, { type:"text", text:`Scan this automotive receipt. Return ONLY valid JSON:\n{"vendor":"store name","date":"YYYY-MM-DD or empty","amount":number,"item":"best match from auto categories","category":"Mechanical|Exterior|Tires & Wheels|Fluids|Labor|Fees|Other","note":"key details"}` }] }] }),
      });

      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const data  = await resp.json();
      const text  = (data.content || []).map((b) => b.text || "").join("").trim();
      const clean = text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim();
      const parsed = JSON.parse(clean);
      setScanRaw(parsed);
      setScanResult({ summary:`Found: ${parsed.item} — $${parsed.amount}`, details:parsed.vendor ? `${parsed.vendor}${parsed.date ? " · " + parsed.date : ""}` : "" });
    } catch (e) {
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
    const firestoreReceipts = receipts.map((r) => ({ name:r.name, type:r.type, isPdf:r.isPdf||false, localId:r.localId||null, dataUrl:r.firestoreDataUrl||(r.isPdf?null:r.dataUrl)||null }));
    onSave({ category, item:finalItem, amount:Number(amount), vendor, date, note, receipts:firestoreReceipts });
  }

  return (
    <div style={{ animation: "slideUp 0.2s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Add Expense</h1>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 16px" }}>{vehicle.year} {vehicle.make} {vehicle.model}</p>
      <AIScanner title="AI Receipt Scanner" description="Take a photo or upload a receipt — AI reads it and fills the form. Files saved for CRA records."
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
  const [salePrice, setSalePrice]       = useState(vehicle.estimatedSale || "");
  const [soldDate, setSoldDate]         = useState(today());
  const [hstCollected, setHstCollected] = useState(false);
  const profit    = Number(salePrice) - totalCost;
  const margin    = totalCost > 0 ? (profit / totalCost) * 100 : 0;
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.slateLight, borderRadius:10, padding:"12px 14px" }}>
          <div>
            <div style={{ fontWeight:600, fontSize:14, color:C.navy }}>HST Collected</div>
            <div style={{ fontSize:12, color:C.textMuted }}>Did you charge HST on this sale?</div>
          </div>
          <button onClick={() => setHstCollected(p => !p)} style={{ background:hstCollected ? C.green : C.border, border:"none", borderRadius:20, width:44, height:24, cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
            <div style={{ position:"absolute", top:2, left:hstCollected ? 22 : 2, width:20, height:20, background:C.white, borderRadius:"50%", transition:"left 0.2s" }} />
          </button>
        </div>
        {hstCollected && Number(salePrice) > 0 && (
          <div style={{ background:C.greenLight, borderRadius:10, padding:12, fontSize:13, color:C.green, fontWeight:600 }}>
            HST to remit to CRA: {fmtDec(hstAmount)}
          </div>
        )}
        {Number(salePrice) > 0 && (
          <div style={{ background:profit>=0 ? C.greenLight : C.redLight, border:`1.5px solid ${profit>=0 ? C.green : C.red}`, borderRadius:12, padding:16, display:"flex", alignItems:"center", gap:14 }}>
            <ProfitRing margin={margin} size={56} />
            <div>
              <div style={{ fontSize:12, color:C.textMuted }}>Net Profit</div>
              <div style={{ fontSize:24, fontWeight:800, color:profit>=0 ? C.green : C.red }}>{fmt(profit)}</div>
              <div style={{ fontSize:12, color:C.textMuted }}>{margin.toFixed(1)}% margin</div>
            </div>
          </div>
        )}
        <Btn full color={C.green} size="lg" disabled={saving} onClick={() => {
          if (!salePrice) { alert("Enter a sale price."); return; }
          onSave({ salePrice:Number(salePrice), soldDate, hstCollected, hstAmount });
        }}>
          {saving ? "Saving..." : <><Ico name="check" size={20} color={C.white} />Confirm Sale</>}
        </Btn>
      </div>
    </div>
  );
}

// ── Edit Vehicle Form ─────────────────────────────────────────────────────────
function EditVehicleForm({ vehicle: v, onSave, saving }) {
  const [form, setForm] = useState({ year:v.year||"", make:v.make||"", model:v.model||"", trim:v.trim||"", vin:v.vin||"", mileage:String(v.mileage||""), purchaseDate:v.purchaseDate||today(), purchasePrice:String(v.purchasePrice||""), estimatedSale:String(v.estimatedSale||""), status:v.status||"In Repair" });
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
        <Field label="Mileage (km)"          value={form.mileage}      onChange={(val) => set("mileage", val)}      type="number" />
        <Field label="Purchase Date"         value={form.purchaseDate}  onChange={(val) => set("purchaseDate", val)}  type="date" />
        <Field label="Purchase Price (CAD)"  value={form.purchasePrice} onChange={(val) => set("purchasePrice", val)} type="number" />
        <Field label="Est. Sale Price (CAD)" value={form.estimatedSale} onChange={(val) => set("estimatedSale", val)} type="number" />
        <div>
          <label style={S.label}>Status</label>
          <div style={{ display:"flex", gap:8 }}>
            {["In Repair","Available","Sold"].map((s) => {
              const sm = STATUS_META[s];
              const active = form.status === s;
              return <button key={s} onClick={() => set("status", s)} style={{ flex:1, background:active ? sm.bg : C.slateLight, color:active ? sm.color : C.textMuted, border:`2px solid ${active ? sm.color : C.border}`, padding:"10px 6px", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer" }}>{sm.icon} {s}</button>;
            })}
          </div>
        </div>
        <Btn full color={C.blue} size="lg" disabled={saving} onClick={() => {
          if (!form.year || !form.make || !form.model || !form.purchasePrice) { alert("Year, Make, Model and Purchase Price are required."); return; }
          onSave({ year:form.year, make:form.make, model:form.model, trim:form.trim, vin:form.vin, mileage:Number(form.mileage)||0, purchaseDate:form.purchaseDate, purchasePrice:Number(form.purchasePrice), estimatedSale:Number(form.estimatedSale)||0, status:form.status });
        }}>
          {saving ? "Saving..." : <><Ico name="check" size={20} color={C.white} />Save Changes</>}
        </Btn>
      </div>
    </div>
  );
}
