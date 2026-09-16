import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, onSnapshot,
  addDoc, updateDoc, deleteDoc, setDoc, serverTimestamp
} from "firebase/firestore";

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

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:"#0F172A", surface:"#1E293B", surfaceHi:"#263448",
  border:"#334155", borderHi:"#475569",
  amber:"#F59E0B", amberBg:"rgba(245,158,11,0.12)", amberDim:"#78350F",
  green:"#10B981", greenBg:"rgba(16,185,129,0.12)",
  red:"#F43F5E", redBg:"rgba(244,63,94,0.12)",
  blue:"#3B82F6", blueBg:"rgba(59,130,246,0.12)",
  teal:"#06B6D4", tealBg:"rgba(6,182,212,0.12)",
  purple:"#8B5CF6", purpleBg:"rgba(139,92,246,0.12)",
  textPrimary:"#F1F5F9", textSecondary:"#94A3B8", textMuted:"#64748B",
};

// ── Ontario fees ──────────────────────────────────────────────────────────────
function calcBuyerFee(p) {
  p = Number(p)||0;
  if(p<=99) return 25; if(p<=499) return 65; if(p<=999) return 90;
  if(p<=1499) return 115; if(p<=1999) return 140; if(p<=2999) return 175;
  if(p<=3999) return 225; if(p<=4999) return 275; if(p<=5999) return 325;
  if(p<=6999) return 375; if(p<=7999) return 425; if(p<=9999) return 475;
  if(p<=11999) return 525; if(p<=13999) return 575; return 625;
}
const FIXED = { virtualBid:109, gate:79, omvic:22, carfax:39.55, transport:300, safety:110 };
const HST_RATE = 0.13;
function calcAuction(hammer) {
  const p=Number(hammer)||0, bf=calcBuyerFee(p);
  const sub=p+bf+FIXED.virtualBid+FIXED.gate+FIXED.omvic+FIXED.carfax;
  const hst=Math.round(sub*HST_RATE*100)/100;
  return { buyerFee:bf, hst, totalAuctionCost:sub+hst };
}

// ── LocalStorage ──────────────────────────────────────────────────────────────
const LS="afp_";
function saveLocal(id,data){try{localStorage.setItem(LS+id,data);return true;}catch{return false;}}
function loadLocal(id){try{return localStorage.getItem(LS+id);}catch{return null;}}

// ── Vehicle DB ────────────────────────────────────────────────────────────────
const VEHICLE_DB = {
  Acura:{MDX:["Base","Tech","A-Spec","SH-AWD"],RDX:["Base","Tech","A-Spec","Advance"],TLX:["Base","Tech","Type S"]},
  BMW:{"3 Series":["320i","330i","M340i"],"5 Series":["530i","540i","M550i"],X3:["sDrive30i","xDrive30i","M40i"],X5:["sDrive40i","xDrive40i","M50i"]},
  Buick:{Enclave:["Preferred","Essence","Premium","Avenir"],Encore:["Preferred","Essence"],Envision:["Preferred","Essence","Avenir"]},
  Cadillac:{XT4:["Luxury","Premium Luxury","Sport"],XT5:["Luxury","Premium Luxury","Sport"],Escalade:["Luxury","Premium Luxury","Platinum"]},
  Chevrolet:{Silverado:["WT","Custom","LT","RST","LTZ","High Country"],Equinox:["LS","LT","RS","Premier"],Traverse:["LS","LT","RS","Premier"],Malibu:["LS","LT","RS"],Colorado:["WT","LT","Z71","Trail Boss"]},
  Chrysler:{"300":["Touring","S","Limited","Platinum"],Pacifica:["Touring","Touring L","Limited","Pinnacle"]},
  Dodge:{"Grand Caravan":["SE","SXT","GT"],Durango:["SXT","GT","R/T","Citadel"],Challenger:["SXT","GT","R/T","Scat Pack"],Charger:["SXT","GT","R/T","Scat Pack"]},
  Ford:{"F-150":["XL","XLT","Lariat","King Ranch","Platinum","Limited","Raptor"],Explorer:["Base","XLT","ST-Line","Limited","Platinum"],Escape:["S","SE","SE Sport","Titanium"],Edge:["SE","SEL","Titanium","ST"],Mustang:["EcoBoost","GT","Mach 1"],Ranger:["XL","XLT","Lariat"]},
  GMC:{Sierra:["Base","SLE","Elevation","SLT","AT4","Denali"],Terrain:["SLE","SLT","AT4","Denali"],Acadia:["SLE","SLT","AT4","Denali"],Yukon:["SLE","SLT","AT4","Denali"]},
  Honda:{"CR-V":["LX","EX","EX-L","Sport","Touring","Sport Hybrid","Touring Hybrid"],Civic:["LX","Sport","EX","EX-L","Touring","Si","Type R"],Accord:["LX","Sport","EX","EX-L","Touring"],Pilot:["LX","EX","EX-L","TrailSport","Touring","Elite"],Odyssey:["LX","EX","EX-L","Touring","Elite"],"HR-V":["LX","EX","EX-L","Sport"]},
  Hyundai:{Tucson:["Essential","Preferred","Trend","Ultimate","N Line"],"Santa Fe":["Essential","Preferred","Trend","Ultimate"],Elantra:["Essential","Preferred","Sport","Luxury","N"],Sonata:["Essential","Preferred","Sport","Ultimate"],Kona:["Essential","Preferred","Trend","Ultimate"]},
  Jeep:{"Grand Cherokee":["Laredo","Altitude","Limited","Trailhawk","Overland","Summit"],Wrangler:["Sport","Sport S","Sahara","Rubicon"],Cherokee:["Latitude","Limited","Trailhawk","Overland"],Compass:["Sport","North","Altitude","Limited"]},
  Kia:{Sorento:["LX","S","EX","SX"],Sportage:["LX","EX","SX"],Telluride:["LX","S","EX","SX"],Forte:["LX","GT-Line","EX","GT"]},
  Lexus:{RX:["RX350","RX350L","RX450h"],NX:["NX250","NX350","NX350h"],ES:["ES250","ES300h","ES350"],GX:["GX460"]},
  Lincoln:{Navigator:["Standard","Reserve","Black Label"],Aviator:["Standard","Reserve","Black Label"],Nautilus:["Standard","Select","Reserve"]},
  Mazda:{"CX-5":["GX","GS","GT","Signature"],"CX-9":["GS","GT","Signature"],Mazda3:["GX","GS","GT","Turbo"]},
  Mercedes:{"C-Class":["C300","C43 AMG"],"E-Class":["E350","E450"],GLE:["GLE350","GLE450"],GLC:["GLC300","GLC43"]},
  Nissan:{Rogue:["S","SV","SL","Platinum"],Altima:["S","SV","SR","SL"],Murano:["S","SV","SL"],Pathfinder:["S","SV","SL","Platinum"],Frontier:["S","SV","Pro-4X"]},
  RAM:{"1500":["Tradesman","Big Horn","Laramie","Rebel","Limited","TRX"],"2500":["Tradesman","Big Horn","Laramie","Power Wagon","Limited"]},
  Subaru:{Forester:["Base","Premium","Sport","Limited","Touring"],Outback:["Base","Premium","Limited","Touring","Wilderness"],Crosstrek:["Base","Premium","Sport","Limited"]},
  Tesla:{"Model 3":["Standard Range","Long Range","Performance"],"Model Y":["Long Range","Performance"],"Model S":["Long Range","Plaid"]},
  Toyota:{"RAV4":["LE","XLE","XLE Premium","TRD Off-Road","Adventure","Limited","Hybrid LE","Hybrid XSE","Hybrid Limited","Prime SE","Prime XSE"],Camry:["LE","SE","XSE","XLE","TRD","Hybrid LE","Hybrid XSE"],Corolla:["L","LE","SE","XSE","XLE"],Highlander:["L","LE","XLE","Limited","Platinum","Hybrid LE"],Tacoma:["SR","SR5","TRD Sport","TRD Off-Road","Limited","TRD Pro"],Tundra:["SR","SR5","TRD Sport","Limited","Platinum","TRD Pro"],Sienna:["LE","XLE","XSE","Limited","Platinum"],"4Runner":["SR5","TRD Sport","TRD Off-Road","Limited","TRD Pro"]},
  Volkswagen:{Tiguan:["Trendline","Comfortline","Highline","R-Line"],Jetta:["Trendline","Comfortline","Highline","GLI"],Atlas:["Trendline","Comfortline","Highline"]},
  Volvo:{XC60:["Core","Plus","Ultimate"],XC90:["Core","Plus","Ultimate"],XC40:["Core","Plus","Recharge"]},
};
const MAKES = Object.keys(VEHICLE_DB).sort();
const YEARS = Array.from({length:20},(_,i)=>String(2025-i));

const EXPENSE_CATS = {
  Mechanical:["Battery","Alternator","Starter","Transmission","Engine","Brakes","Suspension","Steering","Oil Change","Exhaust","AC Compressor","Radiator","Catalytic Converter"],
  Exterior:["Front Bumper","Rear Bumper","Front Fender","Rear Fender","Hood","Door","Mirror","Headlight","Tail Light","Windshield","Side Panel"],
  "Tires & Wheels":["Tire","Rim","Wheel Bearing","TPMS Sensor"],
  Fluids:["Oil","Coolant","Brake Fluid","Transmission Fluid","Power Steering Fluid"],
  Labor:["Mechanic Labor","Body Shop Labor","Painting","Detailing","Diagnostic"],
  Fees:["Safety Certificate","Licensing","Towing","Auction Fee","Buyer Fee","Virtual Bid Fee","Gate Fee","HST"],
  Other:["Custom..."],
};

const INSPECT_SECTIONS = [
  {id:"ext",  emoji:"🚗",label:"Exterior body",       items:["Hood","Front bumper","Front grille","Left front fender","Right front fender","Left front door","Right front door","Left rear door","Right rear door","Trunk / tailgate","Rear bumper","Left tail light","Right tail light","Left headlight","Right headlight","Left mirror","Right mirror","Windshield","Rear glass"]},
  {id:"mech", emoji:"⚙️",label:"Mechanical",          items:["Engine check","Transmission fluid","Oil level","Coolant level","Power steering fluid","Brake fluid","Battery","Alternator","AC compressor","Radiator","Belts and hoses","Exhaust","Catalytic converter"]},
  {id:"tyres",emoji:"🔵",label:"Tyres and wheels",    items:["Front left tyre","Front right tyre","Rear left tyre","Rear right tyre","Front left rim","Front right rim","Rear left rim","Rear right rim","Spare tyre"]},
  {id:"brake",emoji:"🛑",label:"Brakes / suspension", items:["Front left pad","Front right pad","Rear left pad","Rear right pad","Front left rotor","Front right rotor","Rear left rotor","Rear right rotor","Front left strut","Front right strut","Rear left strut","Rear right strut","Control arms","Tie rods"]},
  {id:"int",  emoji:"🪑",label:"Interior",             items:["Driver seat","Passenger seat","Rear seats","Dashboard","Centre console","Headliner","Carpet","Door panels","Steering wheel","Infotainment screen","Instrument cluster"]},
  {id:"safe", emoji:"🛡️",label:"Safety / airbags",   items:["Driver airbag","Passenger airbag","Left curtain airbag","Right curtain airbag","Seat belt driver","Seat belt passenger","Seat belt rear","SRS module","ABS","TPMS","ADAS calibration"]},
  {id:"elec", emoji:"⚡",label:"Electrical",           items:["Headlights","Tail lights","Turn signals","Reverse lights","Interior lights","Power windows","Power locks","Key fob","OBD scan","Backup camera","Parking sensors"]},
];

const PARTS_CAT = {
  "Front end":{"Front bumper cover":280,"Hood":420,"Left headlight":260,"Right headlight":260,"Grille":180,"Radiator":320,"Condenser":280,"Fender L":390,"Fender R":390,"Radiator support":210},
  "Rear end":{"Rear bumper cover":240,"Trunk lid":350,"Tailgate":480,"Left tail light":190,"Right tail light":190,"Quarter panel L":520,"Quarter panel R":520},
  "Doors":{"Front door L":580,"Front door R":580,"Rear door L":540,"Rear door R":540,"Mirror L":220,"Mirror R":220},
  "Airbags":{"Driver airbag":480,"Passenger airbag":420,"Seat belt L":280,"Seat belt R":280,"SRS module":350,"Curtain airbag L":390,"Curtain airbag R":390},
  "Mechanical":{"Engine assembly":2800,"Transmission":1800,"Cat converter":620,"ECU module":480,"ADAS calibration":650,"Strut L":310,"Strut R":310},
};

const LABOR_DEF = {
  "Front bumper cover":{b:2,p:2.5},"Hood":{b:1.5,p:3},"Left headlight":{b:0.5,p:0},"Right headlight":{b:0.5,p:0},
  "Fender L":{b:2,p:3},"Fender R":{b:2,p:3},"Front door L":{b:3,p:3.5},"Front door R":{b:3,p:3.5},
  "Rear door L":{b:2.5,p:3},"Rear door R":{b:2.5,p:3},"Trunk lid":{b:2,p:2.5},"Tailgate":{b:2.5,p:3},
  "Rear bumper cover":{b:1.5,p:2},"Quarter panel L":{b:6,p:4},"Quarter panel R":{b:6,p:4},
  "Driver airbag":{b:1.5,p:0},"Passenger airbag":{b:2,p:0},"SRS module":{b:1,p:0},
};

const STATUS_CFG = {
  "In Repair":{color:T.amber, bg:T.amberBg, emoji:"🔧"},
  Available:  {color:T.green, bg:T.greenBg, emoji:"✅"},
  Sold:       {color:T.purple,bg:T.purpleBg,emoji:"🏁"},
};

const PREFERRED_MODELS = [
  {make:"Honda",  model:"CR-V",         why:"Your #1 seller · avg 14 days on market"},
  {make:"Toyota", model:"RAV4",         why:"High Ontario demand · AWD commands premium"},
  {make:"Honda",  model:"Civic",        why:"Fast mover · avg 9 days to sell"},
  {make:"Toyota", model:"Camry",        why:"Proven margin · quick to certify"},
  {make:"Ford",   model:"F-150",        why:"High ticket · strong margin potential"},
  {make:"RAM",    model:"1500",         why:"Truck segment · competitive pricing"},
  {make:"Dodge",  model:"Grand Caravan",why:"High Ontario family demand"},
  {make:"Toyota", model:"Sienna",       why:"Van segment · limited competition"},
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = n => new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(n||0);
const fmtD = n => new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",minimumFractionDigits:2}).format(n||0);
const uid  = () => Math.random().toString(36).slice(2,9);
const today= () => new Date().toISOString().slice(0,10);

function compressImg(dataUrl,w=800,q=0.7){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement("canvas"),s=Math.min(1,w/img.width);
      c.width=img.width*s;c.height=img.height*s;
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      res(c.toDataURL("image/jpeg",q));
    };
    img.onerror=()=>res(dataUrl);img.src=dataUrl;
  });
}

function calcV(v){
  const exp=(v.expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  const cost=Number(v.purchasePrice||0)+exp;
  const profit=v.status==="Sold"?Number(v.salePrice||0)-cost:Number(v.estimatedSale||0)-cost;
  return {exp,cost,profit,margin:cost>0?(profit/cost)*100:0};
}

function allReceipts(v){
  const out=[];
  (v.expenses||[]).forEach(e=>(e.receipts||[]).forEach(r=>out.push({...r,expItem:e.item,expDate:e.date,expVendor:e.vendor})));
  return out;
}

function dlUrl(url,name){const a=document.createElement("a");a.href=url;a.download=name||"file";document.body.appendChild(a);a.click();document.body.removeChild(a);}
function fileToUrl(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}

function exportCSV(vehicles){
  const rows=[["Year","Make","Model","Trim","VIN","Mileage","Purchase Date","Purchase Price","Total Expenses","Total Cost","Status","Sale Price","Profit","Margin %"]];
  vehicles.forEach(v=>{const{exp,cost,profit,margin}=calcV(v);rows.push([v.year,v.make,v.model,v.trim||"",v.vin||"",v.mileage||"",v.purchaseDate,v.purchasePrice,exp,cost,v.status,v.salePrice||"",profit.toFixed(0),margin.toFixed(1)+"%"]);});
  const blob=new Blob([rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n")],{type:"text/csv"});
  dlUrl(URL.createObjectURL(blob),`AutoFlipPro_${today()}.csv`);
}

function fmtCountdown(target){
  const d=target-Date.now();
  if(d<=0)return"Sale ended";
  const dy=Math.floor(d/86400000),h=Math.floor((d%86400000)/3600000),m=Math.floor((d%3600000)/60000),s=Math.floor((d%60000)/1000);
  if(dy>0)return`${dy}d ${h}h ${m}m`;if(h>0)return`${h}h ${m}m ${s}s`;return`${m}m ${s}s`;
}

const AUCTION_URLS = {
  copart:(make,model)=>`https://www.copart.ca/vehicleFinder/?free-form-search=${encodeURIComponent(make+" "+model)}`,
  iaa:(make,model)=>`https://ca.iaai.com/Search?SearchText=${encodeURIComponent(make+" "+model)}&Zip=L2A&Miles=250`,
};

// ── Shared components ─────────────────────────────────────────────────────────
function Card({children,style={},onClick}){
  return <div onClick={onClick} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",...style}}>{children}</div>;
}
function Pill({children,color=T.amber,bg=T.amberBg,style={}}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:bg,color,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,...style}}>{children}</span>;
}
function Ring({margin,size=52}){
  const r=20,circ=2*Math.PI*r,cl=Math.max(0,Math.min(100,margin));
  const color=margin<0?T.red:margin<15?T.amber:T.green;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke={T.border} strokeWidth="4"/>
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${(cl/100)*circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 26 26)"/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color}}>{margin.toFixed(0)}%</div>
    </div>
  );
}
function Tabs({tabs,active,onChange}){
  return(
    <div style={{display:"flex",background:T.surfaceHi,borderRadius:12,padding:4,gap:3}}>
      {tabs.map(({id,label})=>(
        <button key={id} onClick={()=>onChange(id)} style={{flex:1,padding:"8px 4px",background:active===id?T.amber:"transparent",color:active===id?"#000":T.textSecondary,border:"none",borderRadius:9,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{label}</button>
      ))}
    </div>
  );
}
function Inp({label,value,onChange,placeholder,type="text",style={}}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5,...style}}>
      {label&&<label style={{fontSize:12,fontWeight:600,color:T.textSecondary}}>{label}</label>}
      <input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}
        style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",color:T.textPrimary,fontSize:15,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}/>
    </div>
  );
}
function Sel({label,value,options,onChange,placeholder="Select..."}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:12,fontWeight:600,color:T.textSecondary}}>{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:10,padding:"12px 14px",color:value?T.textPrimary:T.textMuted,fontSize:15,outline:"none",fontFamily:"inherit",width:"100%",appearance:"none",WebkitAppearance:"none"}}>
        <option value="">{placeholder}</option>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Btn({children,onClick,color=T.amber,tc="#000",full=false,size="md",outline=false,disabled=false,style={}}){
  const pad=size==="lg"?"14px 24px":size==="sm"?"7px 14px":"11px 18px";
  return(
    <button onClick={onClick} disabled={disabled} style={{background:outline?"transparent":disabled?"#334155":color,color:outline?color:tc,border:`2px solid ${disabled?"#334155":color}`,padding:pad,borderRadius:12,fontWeight:700,fontSize:size==="lg"?16:size==="sm"?12:14,cursor:disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,width:full?"100%":"auto",opacity:disabled?0.5:1,fontFamily:"inherit",...style}}>{children}</button>
  );
}

// ── AI Scanner ────────────────────────────────────────────────────────────────
function AIScanner({title,desc,onFile,scanning,error,result,onApply,files,onRemove}){
  const camRef=useRef(),upRef=useRef();
  return(
    <div style={{background:"linear-gradient(135deg,#0F172A,#1E293B)",border:`1px solid ${T.amber}33`,borderRadius:16,padding:18,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
        <span style={{fontSize:18}}>✨</span>
        <span style={{fontWeight:800,fontSize:15,color:T.textPrimary}}>{title}</span>
        <span style={{background:T.amber,color:"#000",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>AI</span>
      </div>
      <p style={{color:T.textSecondary,fontSize:12,margin:"0 0 14px",lineHeight:1.5}}>{desc}</p>
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);e.target.value="";}}/>
      <input ref={upRef} type="file" accept="image/*,application/pdf,.pdf" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);e.target.value="";}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>camRef.current?.click()} disabled={scanning} style={{background:T.amber,border:"none",borderRadius:12,padding:"13px 10px",cursor:scanning?"not-allowed":"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,opacity:scanning?0.6:1}}>
          <span style={{fontSize:24}}>📷</span><span style={{color:"#000",fontWeight:700,fontSize:12}}>Take photo</span>
        </button>
        <button onClick={()=>upRef.current?.click()} disabled={scanning} style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px 10px",cursor:scanning?"not-allowed":"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,opacity:scanning?0.6:1}}>
          <span style={{fontSize:24}}>📎</span><span style={{color:T.textPrimary,fontWeight:700,fontSize:12}}>Upload PDF/image</span>
        </button>
      </div>
      {scanning&&<div style={{display:"flex",alignItems:"center",gap:10,marginTop:12}}><div style={{width:16,height:16,border:"3px solid #334155",borderTop:`3px solid ${T.amber}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/><span style={{color:T.amber,fontSize:13,fontWeight:600}}>Scanning…</span></div>}
      {error&&<div style={{background:T.redBg,border:`1px solid ${T.red}44`,borderRadius:10,padding:"10px 14px",marginTop:12,fontSize:12,color:T.red}}>{error}</div>}
      {result&&(
        <div style={{background:T.greenBg,border:`1px solid ${T.green}44`,borderRadius:12,padding:14,marginTop:12}}>
          <div style={{fontWeight:700,color:T.green,marginBottom:6,fontSize:13}}>✅ {result.summary}</div>
          {result.details&&<div style={{fontSize:12,color:T.textSecondary,marginBottom:10}}>{result.details}</div>}
          <Btn full color={T.amber} onClick={onApply} size="sm">Apply to form</Btn>
        </div>
      )}
      {files&&files.length>0&&(
        <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
          {files.map((f,i)=>(
            <div key={i} style={{position:"relative"}}>
              <div style={{width:52,height:52,borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceHi,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                {f.isPdf?<span style={{fontSize:20}}>📄</span>:<img src={f.dataUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>}
              </div>
              {onRemove&&<button onClick={()=>onRemove(i)} style={{position:"absolute",top:-6,right:-6,background:T.red,border:"none",borderRadius:"50%",width:18,height:18,cursor:"pointer",color:"#fff",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function AutoFlipPro(){
  const [vehicles,setVehicles]=useState([]);
  const [queue,setQueue]=useState([]);
  const [lossLog,setLossLog]=useState([]);
  const [loading,setLoading]=useState(true);
  const [dbErr,setDbErr]=useState(null);
  const [view,setView]=useState("dashboard");
  const [selId,setSelId]=useState(null);
  const [saving,setSaving]=useState(false);
  const [lightbox,setLightbox]=useState(null);
  const sel=vehicles.find(v=>v.id===selId);

  useEffect(()=>{
    const u=onSnapshot(collection(db,"vehicles"),snap=>{setVehicles(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));setLoading(false);},(err)=>{setDbErr("Cannot connect to Firestore. Check rules.");setLoading(false);});
    return()=>u();
  },[]);
  useEffect(()=>{const u=onSnapshot(collection(db,"dealQueue"),snap=>{setQueue(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.saleTimestamp||0)-(b.saleTimestamp||0)));});return()=>u();},[]);
  useEffect(()=>{const u=onSnapshot(collection(db,"lossLog"),snap=>{setLossLog(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.loggedAt?.seconds||0)-(a.loggedAt?.seconds||0)));});return()=>u();},[]);

  const stats=vehicles.reduce((a,v)=>{const{cost,profit}=calcV(v);a.invested+=cost;if(v.status==="Sold"){a.profit+=profit;a.sold++;}else{a.inventory+=Number(v.estimatedSale||0);a.active++;}return a;},{invested:0,profit:0,inventory:0,sold:0,active:0});

  async function addVehicle(data){setSaving(true);try{await addDoc(collection(db,"vehicles"),{...data,expenses:[],status:"In Repair",notes:"",createdAt:serverTimestamp()});go("inventory");}catch{alert("Save failed.");}finally{setSaving(false);}}
  async function saveExpense(vid,exp){setSaving(true);try{const v=vehicles.find(x=>x.id===vid);await updateDoc(doc(db,"vehicles",vid),{expenses:[...(v.expenses||[]),{...exp,id:uid()}]});go("detail");}catch{alert("Save failed.");}finally{setSaving(false);}}
  async function delExpense(vid,eid){const v=vehicles.find(x=>x.id===vid);await updateDoc(doc(db,"vehicles",vid),{expenses:(v.expenses||[]).filter(e=>e.id!==eid)});}
  async function markSold(vid,data){setSaving(true);try{await updateDoc(doc(db,"vehicles",vid),{status:"Sold",...data});go("detail");}catch{alert("Save failed.");}finally{setSaving(false);}}
  async function editVehicle(vid,data){setSaving(true);try{await updateDoc(doc(db,"vehicles",vid),data);go("detail");}catch{alert("Update failed.");}finally{setSaving(false);}}
  async function saveNotes(vid,notes){await updateDoc(doc(db,"vehicles",vid),{notes});}
  async function delVehicle(vid){if(!window.confirm("Delete this vehicle?"))return;setSaving(true);try{await deleteDoc(doc(db,"vehicles",vid));go("inventory");}catch{alert("Delete failed.");}finally{setSaving(false);}}
  async function addQueue(data){setSaving(true);try{await addDoc(collection(db,"dealQueue"),{...data,status:"watching",createdAt:serverTimestamp()});}catch{alert("Save failed.");}finally{setSaving(false);}}
  async function markWon(item){setSaving(true);try{await updateDoc(doc(db,"dealQueue",item.id),{status:"won"});await addDoc(collection(db,"vehicles"),{year:item.year||"",make:item.make||"",model:item.model||"",trim:"",vin:"",mileage:0,purchaseDate:today(),purchasePrice:Number(item.maxBid)||0,estimatedSale:Number(item.retail)||0,expenses:[],status:"In Repair",notes:`Won at ${item.source||"auction"} · Lot ${item.lot||""}`,createdAt:serverTimestamp()});}catch{alert("Save failed.");}finally{setSaving(false);}}
  async function logLoss(qid,data){setSaving(true);try{await updateDoc(doc(db,"dealQueue",qid),{status:"lost"});await addDoc(collection(db,"lossLog"),{...data,loggedAt:serverTimestamp()});}catch{alert("Save failed.");}finally{setSaving(false);}}
  async function saveInspection(vid,data){setSaving(true);try{await setDoc(doc(db,"inspections",vid),{...data,updatedAt:serverTimestamp()});}catch{alert("Save failed.");}finally{setSaving(false);}}

  function go(v,id){if(id)setSelId(id);setView(v);}
  const backTo=["addExpense","sell","docs","editVehicle","notes","inspection"].includes(view)?"detail":"inventory";

  if(loading)return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{width:40,height:40,border:`3px solid ${T.border}`,borderTop:`3px solid ${T.amber}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><span style={{color:T.textSecondary,fontSize:14}}>Loading AutoFlip Pro…</span><style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}body{margin:0;background:${T.bg}}input,select,button,textarea{font-family:inherit}`}</style></div>);
  if(dbErr)return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:24,textAlign:"center"}}><span style={{fontSize:48}}>⚠️</span><h2 style={{color:T.red,margin:0}}>Database Error</h2><p style={{color:T.textSecondary,maxWidth:340,fontSize:14}}>{dbErr}</p></div>);

  return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:T.bg,minHeight:"100vh",color:T.textPrimary,maxWidth:480,margin:"0 auto"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}body{margin:0;background:${T.bg}}input,select,button,textarea{font-family:inherit}::-webkit-scrollbar{display:none}`}</style>

      {lightbox&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:2000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setLightbox(null)}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:460}}>
            {lightbox.isPdf||!lightbox.dataUrl?<div style={{background:T.surface,borderRadius:16,padding:40,textAlign:"center"}}><span style={{fontSize:56}}>📄</span><p style={{color:T.textPrimary,marginTop:12,fontWeight:600}}>{lightbox.name}</p></div>:<img src={lightbox.dataUrl} alt="receipt" style={{width:"100%",borderRadius:12,objectFit:"contain",maxHeight:"70vh"}}/>}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              {lightbox.dataUrl&&<Btn full color={T.green} tc="#fff" onClick={()=>dlUrl(lightbox.dataUrl,lightbox.name)}>Download</Btn>}
              <Btn full outline color={T.textSecondary} onClick={()=>setLightbox(null)}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      <header style={{background:T.bg,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {!["dashboard","inventory","calculator","radar","queue"].includes(view)&&(
              <button onClick={()=>go(backTo)} style={{background:T.surfaceHi,border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:T.textSecondary,fontSize:20,lineHeight:1}}>‹</button>
            )}
            <div style={{background:T.amber,borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:11,color:"#000"}}>AFP</div>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:T.textPrimary,lineHeight:1}}>AutoFlip Pro</div>
              <div style={{fontSize:10,color:T.textMuted,lineHeight:1,marginTop:1}}>Ontario · Canada</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {saving&&<div style={{width:8,height:8,borderRadius:"50%",background:T.amber,animation:"spin 1s linear infinite"}}/>}
            <button onClick={()=>exportCSV(vehicles)} style={{background:"none",border:"none",color:T.textMuted,cursor:"pointer",padding:"6px",fontSize:18}} title="Export CSV">↓</button>
            <button onClick={()=>go("addVehicle")} style={{background:T.amber,border:"none",color:"#000",cursor:"pointer",padding:"7px 14px",borderRadius:10,fontWeight:700,fontSize:13}}>+ Add</button>
          </div>
        </div>
      </header>

      <main style={{padding:"16px 16px 100px",animation:"up 0.2s ease"}}>
        {view==="dashboard"   &&<DashView   vehicles={vehicles} stats={stats} queue={queue} onSel={id=>go("detail",id)} onNav={go}/>}
        {view==="inventory"   &&<InvView    vehicles={vehicles} onSel={id=>go("detail",id)} onAdd={()=>go("addVehicle")}/>}
        {view==="calculator"  &&<CalcView/>}
        {view==="radar"       &&<RadarView  queue={queue} onAddQueue={addQueue} saving={saving}/>}
        {view==="queue"       &&<QueueView  items={queue} lossLog={lossLog} onWon={markWon} onLoss={logLoss} saving={saving}/>}
        {view==="detail"      &&sel&&<DetailView v={sel} onAddExp={()=>go("addExpense")} onEdit={()=>go("editVehicle")} onSell={()=>go("sell")} onDel={()=>delVehicle(sel.id)} onDelExp={eid=>delExpense(sel.id,eid)} onDocs={()=>go("docs")} onReceipt={setLightbox} onNotes={()=>go("notes")} onInspect={()=>go("inspection")}/>}
        {view==="addVehicle"  &&<AddVehicleView onSave={addVehicle} saving={saving}/>}
        {view==="editVehicle" &&sel&&<EditVehicleView v={sel} onSave={d=>editVehicle(sel.id,d)} saving={saving}/>}
        {view==="addExpense"  &&sel&&<AddExpenseView v={sel} onSave={exp=>saveExpense(sel.id,exp)} saving={saving}/>}
        {view==="sell"        &&sel&&<SellView v={sel} onSave={d=>markSold(sel.id,d)} saving={saving}/>}
        {view==="docs"        &&sel&&<DocsView v={sel} onReceipt={setLightbox}/>}
        {view==="notes"       &&sel&&<NotesView v={sel} onSave={n=>saveNotes(sel.id,n)}/>}
        {view==="inspection"  &&sel&&<InspectionView v={sel} onSave={d=>saveInspection(sel.id,d)} saving={saving}/>}
      </main>

      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",padding:"8px 0 env(safe-area-inset-bottom)",zIndex:100}}>
        {[{id:"dashboard",icon:"◈",label:"Dashboard"},{id:"inventory",icon:"🚗",label:"Inventory"},{id:"addVehicle",icon:"＋",label:"Add",amber:true},{id:"radar",icon:"◎",label:"Radar"},{id:"queue",icon:"⏱",label:"Queue"}].map(({id,icon,label,amber})=>{
          const active=view===id||(id==="inventory"&&["detail","addExpense","sell","docs","editVehicle","notes","inspection"].includes(view));
          return(<button key={id} onClick={()=>go(id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 0"}}>
            <div style={{background:amber?T.amber:active?"rgba(245,158,11,0.15)":"transparent",borderRadius:12,padding:"6px 16px",transition:"background 0.15s"}}>
              <span style={{fontSize:18,color:amber?"#000":active?T.amber:T.textMuted,lineHeight:1}}>{icon}</span>
            </div>
            <span style={{fontSize:10,fontWeight:600,color:amber?T.amber:active?T.amber:T.textMuted}}>{label}</span>
          </button>);
        })}
      </nav>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashView({vehicles,stats,queue,onSel,onNav}){
  const sold=vehicles.filter(v=>v.status==="Sold");
  const avgM=sold.reduce((s,v)=>{const{cost,profit}=calcV(v);return s+(cost>0?(profit/cost)*100:0);},0)/Math.max(1,sold.length);
  const best=sold.reduce((b,v)=>{const{profit}=calcV(v);return profit>(b?calcV(b).profit:-Infinity)?v:b;},null);
  const watching=queue.filter(q=>q.status==="watching");
  const stale=vehicles.filter(v=>v.status==="Available"&&(Date.now()-(v.createdAt?.seconds||0)*1000)/86400000>30);
  const inRepair=vehicles.filter(v=>v.status==="In Repair");
  const available=vehicles.filter(v=>v.status==="Available");
  return(
    <div>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,color:T.textMuted,marginBottom:4}}>Total profit — 2026</div>
        <div style={{fontSize:42,fontWeight:900,color:T.amber,letterSpacing:-1.5,lineHeight:1}}>{fmt(stats.profit)}</div>
        <div style={{fontSize:13,color:T.textSecondary,marginTop:6}}>{stats.sold} sold · {stats.active} active · {stats.sold+stats.active} total</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[
          {label:"Inventory value",value:fmt(stats.inventory),sub:`${available.length} available`,color:T.green},
          {label:"Capital deployed",value:fmt(stats.invested),sub:"all vehicles",color:T.textPrimary},
          {label:"Avg margin",value:avgM.toFixed(1)+"%",sub:"per sold deal",color:avgM>=20?T.green:T.amber},
          {label:"In repair",value:String(inRepair.length),sub:"being worked on",color:T.amber},
        ].map(m=>(
          <Card key={m.label} style={{padding:"14px 16px"}}>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:6}}>{m.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:m.color,lineHeight:1}}>{m.value}</div>
            <div style={{fontSize:11,color:T.textSecondary,marginTop:4}}>{m.sub}</div>
          </Card>
        ))}
      </div>

      {stale.length>0&&(
        <div style={{background:T.amberBg,border:`1px solid ${T.amber}44`,borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontSize:20,flexShrink:0}}>⚠️</span>
          <div>
            <div style={{fontWeight:700,color:T.amber,fontSize:14}}>{stale.length} vehicle{stale.length>1?"s":""} over 30 days listed</div>
            <div style={{fontSize:12,color:T.textSecondary,marginTop:2}}>{stale.map(v=>`${v.year} ${v.make} ${v.model}`).join(" · ")} — consider adjusting price</div>
          </div>
        </div>
      )}

      <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:10}}>Pipeline</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {[
          {icon:"🏷️",label:"Watching / at auction",count:watching.length,value:fmt(watching.reduce((s,i)=>s+Number(i.maxBid||0),0)),color:T.blue,action:()=>onNav("queue")},
          {icon:"🔧",label:"In repair",count:inRepair.length,value:fmt(inRepair.reduce((s,v)=>s+calcV(v).cost,0)),color:T.amber,action:null},
          {icon:"✅",label:"Available / listed",count:available.length,value:fmt(available.reduce((s,v)=>s+Number(v.estimatedSale||0),0)),color:T.green,action:null},
          {icon:"🏁",label:"Sold — 2026",count:stats.sold,value:fmt(stats.profit),color:T.purple,action:null},
        ].map(row=>(
          <Card key={row.label} onClick={row.action||undefined} style={{padding:"12px 14px",cursor:row.action?"pointer":"default"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${row.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{row.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:T.textPrimary}}>{row.label}</div>
                <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{row.count} vehicle{row.count!==1?"s":""}</div>
              </div>
              <div style={{fontSize:15,fontWeight:800,color:row.color}}>{row.value}</div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        <Card onClick={()=>onNav("calculator")} style={{padding:"14px 16px",cursor:"pointer"}}>
          <div style={{fontSize:24,marginBottom:6}}>🧮</div>
          <div style={{fontWeight:700,fontSize:13,color:T.textPrimary}}>Deal calculator</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Ontario fees + ROI</div>
        </Card>
        <Card onClick={()=>onNav("radar")} style={{padding:"14px 16px",cursor:"pointer"}}>
          <div style={{fontSize:24,marginBottom:6}}>🎯</div>
          <div style={{fontWeight:700,fontSize:13,color:T.textPrimary}}>Bid radar</div>
          <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Score and queue lots</div>
        </Card>
      </div>

      {best&&(
        <Card style={{padding:"14px 16px",marginBottom:20,border:`1px solid ${T.green}44`}}>
          <div style={{fontSize:11,color:T.green,fontWeight:700,marginBottom:6}}>🏆 Best deal</div>
          <div style={{fontWeight:700,fontSize:15,color:T.textPrimary}}>{best.year} {best.make} {best.model}</div>
          <div style={{fontSize:13,color:T.green,fontWeight:700,marginTop:4}}>Profit {fmt(calcV(best).profit)}</div>
        </Card>
      )}

      {vehicles.length>0&&(
        <>
          <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:10}}>Recent vehicles</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {vehicles.slice(0,5).map(v=><VehicleCard key={v.id} v={v} onSel={onSel}/>)}
          </div>
          {vehicles.length>5&&<button onClick={()=>onNav("inventory")} style={{width:"100%",background:"none",border:`1px solid ${T.border}`,borderRadius:12,padding:"12px",color:T.textSecondary,fontSize:13,fontWeight:600,cursor:"pointer",marginTop:10}}>View all {vehicles.length} vehicles →</button>}
        </>
      )}

      {vehicles.length===0&&(
        <Card style={{padding:"48px 20px",textAlign:"center"}}>
          <div style={{fontSize:56,marginBottom:12}}>🚗</div>
          <div style={{fontWeight:700,fontSize:16,color:T.textPrimary,marginBottom:6}}>No vehicles yet</div>
          <div style={{fontSize:13,color:T.textMuted,marginBottom:16}}>Add your first auction purchase to get started.</div>
          <Btn color={T.amber} onClick={()=>onNav("addVehicle")}>Add first vehicle</Btn>
        </Card>
      )}
    </div>
  );
}

// ── Vehicle card ──────────────────────────────────────────────────────────────
function VehicleCard({v,onSel}){
  const{cost,profit,margin}=calcV(v);
  const sc=STATUS_CFG[v.status]||STATUS_CFG["In Repair"];
  return(
    <Card onClick={()=>onSel(v.id)} style={{padding:"14px 16px",cursor:"pointer"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:T.textPrimary,marginBottom:2}}>{v.year} {v.make} {v.model}</div>
          <div style={{fontSize:12,color:T.textMuted,marginBottom:8}}>{v.trim} · {Number(v.mileage||0).toLocaleString()} km</div>
          <Pill color={sc.color} bg={sc.bg}>{sc.emoji} {v.status}</Pill>
        </div>
        <Ring margin={margin} size={52}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
        <div><div style={{fontSize:10,color:T.textMuted,marginBottom:2}}>Invested</div><div style={{fontSize:16,fontWeight:700,color:T.textSecondary}}>{fmt(cost)}</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:10,color:T.textMuted,marginBottom:2}}>{v.status==="Sold"?"Profit":"Est. profit"}</div><div style={{fontSize:16,fontWeight:700,color:profit>=0?T.green:T.red}}>{fmt(profit)}</div></div>
      </div>
    </Card>
  );
}

// ── Inventory ─────────────────────────────────────────────────────────────────
function InvView({vehicles,onSel,onAdd}){
  const[filter,setFilter]=useState("All");
  const[search,setSearch]=useState("");
  const filtered=vehicles.filter(v=>filter==="All"||v.status===filter).filter(v=>{if(!search)return true;const q=search.toLowerCase();return[v.year,v.make,v.model,v.trim,v.vin].some(f=>(f||"").toLowerCase().includes(q));});
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div><div style={{fontSize:20,fontWeight:800,color:T.textPrimary}}>Inventory</div><div style={{fontSize:12,color:T.textMuted}}>{vehicles.length} total</div></div>
        <Btn color={T.amber} onClick={onAdd} size="sm">+ Add</Btn>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search make, model, VIN…" style={{width:"100%",background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.textPrimary,fontSize:14,outline:"none",marginBottom:12,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
        {["All","In Repair","Available","Sold"].map(t=>{const sc=STATUS_CFG[t],on=filter===t;return<button key={t} onClick={()=>setFilter(t)} style={{background:on?(sc?sc.bg:T.amberBg):T.surfaceHi,color:on?(sc?sc.color:T.amber):T.textMuted,border:`1px solid ${on?(sc?sc.color:T.amber):T.border}`,padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{t}{on&&` (${filtered.length})`}</button>;})}
      </div>
      {filtered.length===0&&<Card style={{padding:"40px 20px",textAlign:"center"}}><div style={{fontSize:44}}>🔍</div><p style={{color:T.textSecondary,fontWeight:600,marginTop:8}}>{search?"No matches":"No vehicles"}</p></Card>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>{filtered.map(v=><VehicleCard key={v.id} v={v} onSel={onSel}/>)}</div>
    </div>
  );
}

// ── Vehicle detail ────────────────────────────────────────────────────────────
function DetailView({v,onAddExp,onEdit,onSell,onDel,onDelExp,onDocs,onReceipt,onNotes,onInspect}){
  const{exp,cost,profit,margin}=calcV(v);
  const sc=STATUS_CFG[v.status]||STATUS_CFG["In Repair"];
  const receipts=allReceipts(v);
  return(
    <div>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:20,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,marginBottom:4}}>{v.year} {v.make} {v.model}</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:10}}>{v.trim} · {Number(v.mileage||0).toLocaleString()} km</div>
            <Pill color={sc.color} bg={sc.bg}>{sc.emoji} {v.status}</Pill>
          </div>
          <Ring margin={margin} size={56}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:T.surfaceHi,borderRadius:10,overflow:"hidden",marginTop:14}}>
          {[{l:"Invested",v:fmt(cost)},{l:v.status==="Sold"?"Sale price":"Est. sale",v:fmt(v.status==="Sold"?v.salePrice:v.estimatedSale)},{l:v.status==="Sold"?"Profit":"Est. profit",v:fmt(profit),c:profit>=0?T.green:T.red}].map((item,i,arr)=>(
            <div key={i} style={{padding:"10px 10px",borderRight:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
              <div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>{item.l}</div>
              <div style={{fontSize:14,fontWeight:700,color:item.c||T.textPrimary}}>{item.v}</div>
            </div>
          ))}
        </div>
        {v.vin&&<div style={{marginTop:10,fontSize:11,color:T.textMuted}}>VIN: {v.vin}</div>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {v.status!=="Sold"&&<><Btn full color={T.amber} onClick={onAddExp}>+ Add expense</Btn><Btn full color={T.green} tc="#fff" onClick={onSell}>Mark sold</Btn></>}
        <Btn full outline color={T.textSecondary} onClick={onEdit}>Edit</Btn>
        <Btn full outline color={T.textSecondary} onClick={onNotes}>Notes{v.notes?" ●":""}</Btn>
        {v.status!=="Sold"&&<div style={{gridColumn:"1 / -1"}}><Btn full color={T.teal} tc="#fff" onClick={onInspect}>🔍 Intake inspection</Btn></div>}
      </div>

      {receipts.length>0&&(
        <Card onClick={onDocs} style={{padding:"13px 16px",marginBottom:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>📁</span><div><div style={{fontWeight:600,fontSize:13,color:T.textPrimary}}>Document vault</div><div style={{fontSize:11,color:T.textMuted}}>{receipts.length} receipt{receipts.length!==1?"s":""}</div></div></div>
          <span style={{color:T.textMuted}}>›</span>
        </Card>
      )}

      {v.notes&&<Card style={{padding:"13px 16px",marginBottom:14,border:`1px solid ${T.amber}33`,background:T.amberBg}}><div style={{fontSize:11,color:T.amber,fontWeight:700,marginBottom:4}}>Notes</div><div style={{fontSize:13,color:T.textSecondary,lineHeight:1.5}}>{v.notes}</div></Card>}

      <div style={{fontSize:12,fontWeight:700,color:T.textMuted,marginBottom:10}}>Expenses ({(v.expenses||[]).length})</div>
      <Card style={{marginBottom:14}}>
        {(v.expenses||[]).length===0&&<div style={{padding:"28px 16px",textAlign:"center",color:T.textMuted,fontSize:13}}>No expenses yet</div>}
        {(v.expenses||[]).map((e,i,arr)=>(
          <div key={e.id} style={{padding:"13px 16px",borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                  <Pill color={T.blue} bg={T.blueBg} style={{fontSize:10}}>{e.category}</Pill>
                  <span style={{fontWeight:700,fontSize:14,color:T.textPrimary}}>{e.item}</span>
                </div>
                <div style={{fontSize:11,color:T.textMuted}}>{e.vendor||"—"} · {e.date}</div>
                {e.note&&<div style={{fontSize:11,color:T.textMuted,fontStyle:"italic",marginTop:2}}>{e.note}</div>}
                {(e.receipts||[]).length>0&&(
                  <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                    {e.receipts.map((r,ri)=>(
                      <div key={ri} onClick={()=>{const src=r.isPdf?(r.localId?loadLocal(r.localId):null):r.dataUrl;onReceipt({dataUrl:src,name:r.name,isPdf:r.isPdf});}} style={{width:48,height:48,borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceHi,overflow:"hidden",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {r.isPdf||r.name?.endsWith(".pdf")?<span style={{fontSize:18}}>📄</span>:<img src={r.dataUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,marginLeft:12}}>
                <span style={{fontWeight:800,fontSize:15,color:T.red}}>-{fmt(e.amount)}</span>
                {v.status!=="Sold"&&<button onClick={()=>onDelExp(e.id)} style={{background:T.redBg,border:"none",borderRadius:8,padding:"5px 8px",cursor:"pointer",color:T.red,fontSize:12}}>🗑</button>}
              </div>
            </div>
          </div>
        ))}
        {(v.expenses||[]).length>0&&<div style={{padding:"11px 16px",background:T.surfaceHi,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:T.textMuted}}>Total repairs</span><span style={{fontSize:13,fontWeight:800,color:T.red}}>{fmt(exp)}</span></div>}
      </Card>

      {v.status==="Sold"&&<Card style={{padding:"13px 16px",marginBottom:14,border:`1px solid ${T.green}44`,background:T.greenBg}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:28}}>🏁</span><div><div style={{fontWeight:700,color:T.green}}>Sold for {fmt(v.salePrice)}</div><div style={{fontSize:12,color:T.textSecondary}}>{v.soldDate} · Profit {fmt(profit)}</div></div></div></Card>}
      <Btn full outline color={T.red} onClick={onDel} size="sm">Delete vehicle</Btn>
    </div>
  );
}

// ── Deal Calculator ───────────────────────────────────────────────────────────
function CalcView(){
  const[tab,setTab]=useState("bid");
  const[hammer,setHammer]=useState("");
  const[retail,setRetail]=useState("");
  const[targetROI,setTargetROI]=useState("20");
  const[exit,setExit]=useState("retail");
  const[transport,setTransport]=useState(String(FIXED.transport));
  const[safety,setSafety]=useState(String(FIXED.safety));
  const[repairs,setRepairs]=useState("");
  const[disclosures,setDisc]=useState([]);
  const[parts,setParts]=useState({});
  const[laborLines,setLabor]=useState({});
  const[bodyRate,setBodyRate]=useState("75");
  const[paintRate,setPaintRate]=useState("65");
  const[extraOps,setExtra]=useState({});
  const[openCats,setOpenCats]=useState({});

  const DISC=[{id:"airbag",label:"Airbags deployed",retail:-7,wholesale:-4},{id:"struct",label:"Structural damage",retail:-8,wholesale:-4},{id:"engine",label:"Engine issues",retail:-12,wholesale:-8},{id:"total",label:"Total loss history",retail:-7,wholesale:-3},{id:"multi",label:"Multiple accidents",retail:-5,wholesale:-2}];
  const EXTRA=[{id:"adas",label:"ADAS recalibration",cost:650},{id:"frame",label:"Frame pull / alignment",cost:480},{id:"diag",label:"Diagnostic scan",cost:180},{id:"detail",label:"Full detail and prep",cost:220},{id:"cert",label:"Ontario safety certificate",cost:150}];

  const p=Number(hammer)||0,r=Number(retail)||0,roi=Number(targetROI)||20;
  const discAdj=disclosures.reduce((s,id)=>{const d=DISC.find(x=>x.id===id);return s+(d?(exit==="retail"?d.retail:d.wholesale):0);},0);
  const adjSell=exit==="retail"?r*(1+discAdj/100):r*0.8*(1+discAdj/100);
  const partsTotal=Object.values(parts).reduce((s,v)=>s+v,0);
  const laborCost=Object.entries(laborLines).reduce((s,[,l])=>s+(l.b||0)*(Number(bodyRate)||75)+(l.p||0)*(Number(paintRate)||65),0)+Object.values(extraOps).reduce((s,v)=>s+v,0);
  const{buyerFee,hst,totalAuctionCost}=calcAuction(p);
  const allCosts=p+buyerFee+hst+FIXED.virtualBid+FIXED.gate+FIXED.omvic+FIXED.carfax+partsTotal+laborCost+(Number(repairs)||0)+(Number(transport)||0)+(Number(safety)||0);
  const netProfit=adjSell>0?adjSell-allCosts:0;
  const netROI=allCosts>0&&adjSell>0?(netProfit/allCosts)*100:0;

  const maxBid=adjSell>0?(()=>{
    const fc=FIXED.virtualBid+FIXED.gate+FIXED.omvic+FIXED.carfax+partsTotal+laborCost+(Number(repairs)||0)+(Number(transport)||0)+(Number(safety)||0);
    let lo=0,hi=adjSell;
    for(let i=0;i<60;i++){const g=(lo+hi)/2;const{totalAuctionCost:tac}=calcAuction(g);const tc=tac+fc;const pr=adjSell-tc;if(tc>0&&(pr/tc)*100>roi)lo=g;else hi=g;}
    return Math.floor(lo/50)*50;
  })():0;

  const verdict=!p?null:netROI>=roi?"go":netROI>=10?"caution":"pass";
  const VS={go:{color:T.green,bg:T.greenBg,icon:"✅",text:"Good deal — go for it"},caution:{color:T.amber,bg:T.amberBg,icon:"⚠️",text:"Thin margin — proceed carefully"},pass:{color:T.red,bg:T.redBg,icon:"🚫",text:"Low margin — consider passing"}};

  function togglePart(name,price){
    setParts(prev=>{const n={...prev};if(n[name])delete n[name];else n[name]=price;return n;});
    setLabor(prev=>{const n={...prev};if(parts[name])delete n[name];else n[name]=LABOR_DEF[name]||{b:1,p:1};return n;});
  }

  return(
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:800,color:T.textPrimary}}>Deal calculator</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Ontario fees · parts · labour · ROI targets built in</div>
      </div>
      <Tabs tabs={[{id:"bid",label:"Bid engine"},{id:"parts",label:"Parts"},{id:"labor",label:"Labour"}]} active={tab} onChange={setTab}/>
      <div style={{height:14}}/>

      {tab==="bid"&&(
        <>
          <Card style={{padding:16,marginBottom:12,display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted}}>Auction details</div>
            <Inp label="Hammer / auction price ($)" value={hammer} onChange={setHammer} placeholder="9000" type="number"/>
            <Inp label="Market retail value ($)" value={retail} onChange={setRetail} placeholder="17500" type="number"/>
            {p>0&&(
              <div style={{background:T.surfaceHi,borderRadius:12,padding:14}}>
                <div style={{fontSize:11,fontWeight:700,color:T.blue,marginBottom:10}}>Copart / IAA Ontario fees</div>
                {[["Buyer fee",buyerFee],["Virtual bid fee",FIXED.virtualBid],["Gate fee",FIXED.gate],["OMVIC fee",FIXED.omvic],["CarFax fee",FIXED.carfax],["HST (13%)",hst]].map(([l,val])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
                    <span style={{color:T.textSecondary}}>{l}</span><span style={{fontWeight:600,color:T.textPrimary}}>{fmtD(val)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:800,borderTop:`1px solid ${T.border}`,paddingTop:8,marginTop:4}}>
                  <span style={{color:T.textPrimary}}>Total auction cost</span><span style={{color:T.blue}}>{fmt(totalAuctionCost)}</span>
                </div>
              </div>
            )}
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted}}>Buyer disclosures</div>
            {DISC.map(d=>{const on=disclosures.includes(d.id);return(
              <button key={d.id} onClick={()=>setDisc(p=>on?p.filter(x=>x!==d.id):[...p,d.id])} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",border:`1px solid ${on?T.red:T.border}`,borderRadius:10,background:on?T.redBg:T.surfaceHi,cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:12,fontWeight:600,color:on?T.red:T.textSecondary}}>{d.label}</span>
                <span style={{fontSize:11,color:on?T.red:T.textMuted}}>R {d.retail}% / W {d.wholesale}%</span>
              </button>
            );})}
            {disclosures.length>0&&<div style={{background:T.redBg,borderRadius:10,padding:10,fontSize:12,color:T.red,fontWeight:600}}>Adj: {discAdj.toFixed(0)}% → Adjusted sell: {fmt(adjSell)}</div>}
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted}}>Exit strategy</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["retail","Retail","Private buyer"],["wholesale","Wholesale","Dealer / flip"]].map(([id,label,sub])=>(
                <button key={id} onClick={()=>setExit(id)} style={{padding:"12px 10px",border:`2px solid ${exit===id?T.amber:T.border}`,borderRadius:12,background:exit===id?T.amberBg:T.surfaceHi,cursor:"pointer"}}>
                  <div style={{fontWeight:700,fontSize:13,color:exit===id?T.amber:T.textSecondary}}>{label}</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{sub}</div>
                </button>
              ))}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted}}>Target ROI</div>
            <div style={{display:"flex",gap:6}}>
              {["20","30","40","50"].map(v=>(
                <button key={v} onClick={()=>setTargetROI(v)} style={{flex:1,padding:"10px 4px",border:`2px solid ${targetROI===v?T.amber:T.border}`,borderRadius:10,background:targetROI===v?T.amberBg:T.surfaceHi,color:targetROI===v?T.amber:T.textMuted,fontWeight:700,fontSize:13,cursor:"pointer"}}>{v}%</button>
              ))}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted}}>Additional costs</div>
            <Inp label="Transport ($)" value={transport} onChange={setTransport} placeholder="300" type="number"/>
            <Inp label="Safety certificate ($)" value={safety} onChange={setSafety} placeholder="110" type="number"/>
            {(partsTotal>0||laborCost>0)&&(
              <div style={{background:T.surfaceHi,borderRadius:10,padding:12,display:"flex",flexDirection:"column",gap:6}}>
                {partsTotal>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:T.textSecondary}}>Parts (from Parts tab)</span><span style={{fontWeight:700,color:T.textPrimary}}>{fmt(partsTotal)}</span></div>}
                {laborCost>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:T.textSecondary}}>Labour (from Labour tab)</span><span style={{fontWeight:700,color:T.textPrimary}}>{fmt(laborCost)}</span></div>}
              </div>
            )}
            <Inp label="Other repairs / misc ($)" value={repairs} onChange={setRepairs} placeholder="500" type="number"/>
          </Card>

          {(p>0||adjSell>0)&&(
            <Card style={{overflow:"hidden",marginBottom:12}}>
              <div style={{background:T.surfaceHi,padding:"14px 16px"}}>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:10}}>Deal summary</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
                  {[{l:"All-in cost",v:fmt(allCosts)},{l:"Net profit",v:fmt(netProfit),c:netProfit>=0?T.green:T.red},{l:"ROI",v:netROI.toFixed(1)+"%",c:netROI>=roi?T.green:netROI>=10?T.amber:T.red}].map((x,i,arr)=>(
                    <div key={i} style={{padding:"10px 10px",borderRight:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
                      <div style={{fontSize:10,color:T.textMuted,marginBottom:3}}>{x.l}</div>
                      <div style={{fontSize:15,fontWeight:800,color:x.c||T.textPrimary}}>{x.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              {verdict&&<div style={{background:VS[verdict].bg,padding:"11px 16px",display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>{VS[verdict].icon}</span><span style={{fontWeight:700,color:VS[verdict].color,fontSize:14}}>{VS[verdict].text}</span></div>}
              {maxBid>0&&(
                <div style={{padding:"14px 16px",borderTop:`1px solid ${T.border}`}}>
                  <div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Max bid for {targetROI}% ROI ({exit})</div>
                  <div style={{fontSize:34,fontWeight:900,color:T.amber,letterSpacing:-1}}>{fmt(maxBid)}</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>Do not exceed this to hit your target</div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {tab==="parts"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:600,color:T.textSecondary}}>Parts total</span>
            <span style={{fontSize:22,fontWeight:800,color:partsTotal>0?T.red:T.textMuted}}>{fmt(partsTotal)}</span>
          </div>
          {Object.entries(PARTS_CAT).map(([cat,items])=>(
            <Card key={cat} style={{marginBottom:10}}>
              <button onClick={()=>setOpenCats(p=>({...p,[cat]:!p[cat]}))} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>
                <span style={{fontWeight:700,fontSize:13,color:T.textPrimary}}>{cat}</span>
                <span style={{color:T.textMuted}}>{openCats[cat]?"▲":"▼"}</span>
              </button>
              {openCats[cat]&&(
                <div style={{borderTop:`1px solid ${T.border}`,padding:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {Object.entries(items).map(([name,price])=>{const on=!!parts[name];return(
                    <button key={name} onClick={()=>togglePart(name,price)} style={{padding:"10px 8px",border:`1px solid ${on?T.amber:T.border}`,borderRadius:10,background:on?T.amberBg:T.surfaceHi,cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:12,fontWeight:600,color:on?T.amber:T.textSecondary}}>{name}</div>
                      <div style={{fontSize:11,color:on?T.amber:T.textMuted,marginTop:2}}>{fmt(price)}</div>
                    </button>
                  );})}
                </div>
              )}
            </Card>
          ))}
          {Object.keys(parts).length>0&&<Btn full color={T.amber} onClick={()=>setTab("bid")} style={{marginTop:4}}>Apply to bid engine →</Btn>}
        </>
      )}

      {tab==="labor"&&(
        <>
          <Card style={{padding:16,marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:12}}>Labour rates</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Body rate ($/hr)" value={bodyRate} onChange={setBodyRate} type="number" placeholder="75"/>
              <Inp label="Paint rate ($/hr)" value={paintRate} onChange={setPaintRate} type="number" placeholder="65"/>
            </div>
          </Card>
          {Object.keys(laborLines).length>0?(
            <Card style={{marginBottom:12}}>
              <div style={{padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr 56px 56px 56px",gap:6}}>
                {["Part","Body h","Paint h","Cost"].map(h=><span key={h} style={{fontSize:11,fontWeight:700,color:T.textMuted,textAlign:h==="Cost"?"right":"center"}}>{h}</span>)}
              </div>
              {Object.entries(laborLines).map(([name,line])=>{
                const cost=(line.b||0)*(Number(bodyRate)||75)+(line.p||0)*(Number(paintRate)||65);
                return(
                  <div key={name} style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"1fr 56px 56px 56px",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:12,color:T.textPrimary}}>{name}</span>
                    <input type="number" step="0.5" value={line.b} onChange={e=>setLabor(p=>({...p,[name]:{...p[name],b:Number(e.target.value)||0}}))} style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 4px",fontSize:12,textAlign:"center",color:T.textPrimary,outline:"none"}}/>
                    <input type="number" step="0.5" value={line.p} onChange={e=>setLabor(p=>({...p,[name]:{...p[name],p:Number(e.target.value)||0}}))} style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 4px",fontSize:12,textAlign:"center",color:T.textPrimary,outline:"none"}}/>
                    <span style={{fontSize:12,fontWeight:700,color:T.textPrimary,textAlign:"right"}}>{fmt(cost)}</span>
                  </div>
                );
              })}
            </Card>
          ):(
            <Card style={{padding:"28px 20px",textAlign:"center",marginBottom:12}}><p style={{color:T.textMuted,fontSize:13}}>Select parts in the Parts tab to auto-generate labour lines here.</p></Card>
          )}
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:10}}>Additional operations</div>
          <Card style={{marginBottom:12}}>
            {EXTRA.map(op=>{const on=!!extraOps[op.id];return(
              <button key={op.id} onClick={()=>setExtra(p=>{const n={...p};if(n[op.id])delete n[op.id];else n[op.id]=op.cost;return n;})} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",border:"none",borderBottom:`1px solid ${T.border}`,background:on?T.amberBg:T.surface,cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:13,fontWeight:600,color:on?T.amber:T.textSecondary}}>{op.label}</span>
                <span style={{fontSize:13,fontWeight:700,color:on?T.amber:T.textMuted}}>+{fmt(op.cost)}</span>
              </button>
            );})}
          </Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.surfaceHi,borderRadius:12,padding:"12px 16px",marginBottom:12}}>
            <span style={{fontWeight:700,color:T.textPrimary}}>Total labour</span>
            <span style={{fontSize:22,fontWeight:800,color:laborCost>0?T.red:T.textMuted}}>{fmt(laborCost)}</span>
          </div>
          <Btn full color={T.amber} onClick={()=>setTab("bid")}>Apply to bid engine →</Btn>
        </>
      )}
    </div>
  );
}

// ── Bid Radar ─────────────────────────────────────────────────────────────────
function RadarView({queue,onAddQueue,saving}){
  const[tab,setTab]=useState("scout");
  const[form,setForm]=useState({make:"Honda",model:"CR-V",year:"",source:"Copart Canada",lot:"",saleDate:"",saleTime:"10:00",maxBid:"",retail:"",notes:""});
  const[submitted,setSubmitted]=useState(false);
  const[maxBudget,setMaxBudget]=useState("20000");
  const[minProfit,setMinProfit]=useState("3000");

  const models=form.make?Object.keys(VEHICLE_DB[form.make]||{}).sort():[];
  const sf=(k,v)=>setForm(p=>({...p,[k]:v}));

  function calcScore(){
    const bid=Number(form.maxBid)||0,ret=Number(form.retail)||0;
    if(!bid||!ret)return 0;
    const roi=(ret-bid)/bid*100;
    const isPref=PREFERRED_MODELS.some(m=>m.make===form.make&&m.model===form.model);
    let s=Math.min(50,Math.round(roi));
    if(isPref)s+=20;
    if(ret-bid>5000)s+=15;
    if(ret-bid>8000)s+=10;
    return Math.min(99,s);
  }
  const score=calcScore();
  const scoreColor=s=>s>=85?T.green:s>=70?T.amber:T.red;
  const scoreLabel=s=>s>=85?"Hot deal":s>=70?"Good deal":s>=50?"Consider":"Pass";

  async function submitLot(){
    if(!form.make||!form.saleDate){alert("Make and sale date are required.");return;}
    const ts=new Date(`${form.saleDate}T${form.saleTime||"10:00"}:00`).getTime();
    await onAddQueue({...form,saleTimestamp:ts,maxBid:Number(form.maxBid)||0,retail:Number(form.retail)||0,dealScore:score});
    setSubmitted(true);setTimeout(()=>setSubmitted(false),3000);
    setForm(p=>({...p,lot:"",saleDate:"",saleTime:"10:00",maxBid:"",retail:"",notes:""}));
  }

  return(
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:800,color:T.textPrimary}}>Bid radar</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Scout live lots on Copart and IAA · score before you bid</div>
      </div>
      <Tabs tabs={[{id:"scout",label:"Scout lots"},{id:"models",label:"Target models"},{id:"prefs",label:"Preferences"}]} active={tab} onChange={setTab}/>
      <div style={{height:14}}/>

      {tab==="scout"&&(
        <>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:8}}>Open live auction search</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
            {[{name:"Copart Canada",emoji:"🇨🇦",color:T.green,bg:T.greenBg,fn:"copart"},{name:"IAA Canada",emoji:"🍁",color:T.blue,bg:T.blueBg,fn:"iaa"}].map(site=>(
              <button key={site.name} onClick={()=>window.open(AUCTION_URLS[site.fn](form.make,form.model),"_blank")} style={{background:site.bg,border:`1px solid ${site.color}44`,borderRadius:12,padding:"12px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>
                <span style={{fontSize:22}}>{site.emoji}</span>
                <div><div style={{fontWeight:700,fontSize:12,color:site.color}}>{site.name}</div><div style={{fontSize:10,color:T.textMuted,marginTop:1}}>Search live lots →</div></div>
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:T.textSecondary,background:T.surfaceHi,borderRadius:10,padding:"10px 12px",marginBottom:16,lineHeight:1.5}}>Find a lot on Copart or IAA, then enter the details below to score it and add it to your queue for live countdown tracking.</div>
          <Card style={{padding:16,marginBottom:14,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textMuted}}>Lot details</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Year" value={form.year} onChange={v=>sf("year",v)} placeholder="2022" type="number"/>
              <Sel label="Make" value={form.make} options={MAKES} onChange={v=>{sf("make",v);sf("model","");}}/>
            </div>
            <Sel label="Model" value={form.model} options={models} onChange={v=>sf("model",v)} placeholder={form.make?"Select model…":"Select make first"}/>
            <Sel label="Auction source" value={form.source} options={["Copart Canada","IAA Canada"]} onChange={v=>sf("source",v)}/>
            <Inp label="Lot number" value={form.lot} onChange={v=>sf("lot",v)} placeholder="#44821"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Sale date" value={form.saleDate} onChange={v=>sf("saleDate",v)} type="date"/>
              <Inp label="Sale time" value={form.saleTime} onChange={v=>sf("saleTime",v)} type="time"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Your max bid ($)" value={form.maxBid} onChange={v=>sf("maxBid",v)} placeholder="13000" type="number"/>
              <Inp label="Market retail ($)" value={form.retail} onChange={v=>sf("retail",v)} placeholder="23000" type="number"/>
            </div>
            <Inp label="Notes (damage, condition…)" value={form.notes} onChange={v=>sf("notes",v)} placeholder="Front-end damage, airbag deployed…"/>
            {(Number(form.maxBid)>0&&Number(form.retail)>0)&&(
              <div style={{background:T.surfaceHi,borderRadius:12,padding:14,display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:60,height:60,borderRadius:14,background:`${scoreColor(score)}22`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <div style={{fontSize:24,fontWeight:900,color:scoreColor(score),lineHeight:1}}>{score}</div>
                  <div style={{fontSize:9,color:scoreColor(score),fontWeight:700,marginTop:2}}>SCORE</div>
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:scoreColor(score)}}>{scoreLabel(score)}</div>
                  <div style={{fontSize:12,color:T.textSecondary,marginTop:3}}>Spread: {fmt(Number(form.retail)-Number(form.maxBid))}</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>ROI at max bid: {Number(form.maxBid)>0?((Number(form.retail)-Number(form.maxBid))/Number(form.maxBid)*100).toFixed(0):0}%</div>
                </div>
              </div>
            )}
            <Btn full color={T.amber} onClick={submitLot} disabled={saving}>{submitted?"✅ Added to queue!":saving?"Saving…":"Score and add to queue →"}</Btn>
          </Card>
        </>
      )}

      {tab==="models"&&(
        <>
          <div style={{fontSize:11,color:T.textSecondary,marginBottom:12,lineHeight:1.5}}>Your target models ranked by Ontario market performance. Tap Copart or IAA to search live lots for that model right now.</div>
          {PREFERRED_MODELS.map((m,i)=>(
            <Card key={m.make+m.model} style={{padding:"13px 16px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:32,height:32,borderRadius:8,background:T.amberBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:T.amber,flexShrink:0}}>#{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:T.textPrimary}}>{m.make} {m.model}</div>
                  <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{m.why}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>window.open(AUCTION_URLS.copart(m.make,m.model),"_blank")} style={{background:T.greenBg,border:`1px solid ${T.green}44`,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.green}}>Copart</button>
                  <button onClick={()=>window.open(AUCTION_URLS.iaa(m.make,m.model),"_blank")} style={{background:T.blueBg,border:`1px solid ${T.blue}44`,borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:T.blue}}>IAA</button>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {tab==="prefs"&&(
        <Card style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMuted}}>Bid preferences</div>
          <Inp label="Max budget per vehicle ($)" value={maxBudget} onChange={setMaxBudget} type="number" placeholder="20000"/>
          <Inp label="Minimum target profit ($)" value={minProfit} onChange={setMinProfit} type="number" placeholder="3000"/>
          <Sel label="Preferred auction region" value="Hamilton / Niagara" options={["Hamilton / Niagara","GTA and surrounding","All Ontario"]} onChange={()=>{}}/>
          <div style={{fontSize:11,color:T.textSecondary,background:T.surfaceHi,borderRadius:10,padding:"10px 12px",lineHeight:1.5}}>Preferences weight the deal score — a Honda CR-V within your budget at 20%+ ROI near Hamilton scores highest.</div>
        </Card>
      )}
    </div>
  );
}

// ── Deal Queue ────────────────────────────────────────────────────────────────
function QueueView({items,lossLog,onWon,onLoss,saving}){
  const[tab,setTab]=useState("watching");
  const[lossModal,setLossModal]=useState(null);
  const[lossForm,setLossForm]=useState({reasons:[],hammer:"",ceiling:"",notes:""});
  const[lossErr,setLossErr]=useState("");
  const[tick,setTick]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setTick(p=>p+1),1000);return()=>clearInterval(t);},[]);

  const watching=items.filter(i=>i.status==="watching").sort((a,b)=>(b.dealScore||0)-(a.dealScore||0));
  const won=items.filter(i=>i.status==="won");
  const REASONS=["Margin too thin","Repair too costly","Too competitive","Missed the sale","Title risk","Changed my mind"];
  function toggleR(r){setLossForm(p=>({...p,reasons:p.reasons.includes(r)?p.reasons.filter(x=>x!==r):[...p.reasons,r]}));}
  async function submitLoss(){
    if(!lossForm.reasons.length){setLossErr("Select at least one reason.");return;}
    await onLoss(lossModal.id,{vehicle:`${lossModal.year||""} ${lossModal.make} ${lossModal.model}`.trim(),source:lossModal.source,lot:lossModal.lot,reasons:lossForm.reasons,hammer:Number(lossForm.hammer)||0,ceiling:Number(lossForm.ceiling)||0,notes:lossForm.notes});
    setLossModal(null);setLossForm({reasons:[],hammer:"",ceiling:"",notes:""});setLossErr("");
  }
  const topReason=(()=>{const c={};lossLog.forEach(l=>(l.reasons||[]).forEach(r=>{c[r]=(c[r]||0)+1;}));const t=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];return t?t[0]:"None yet";})();

  return(
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:800,color:T.textPrimary}}>Deal queue</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Live countdowns · mark wins and losses</div>
      </div>
      <Tabs tabs={[{id:"watching",label:`Watching (${watching.length})`},{id:"won",label:`Won (${won.length})`},{id:"lost",label:`Lost (${lossLog.length})`}]} active={tab} onChange={setTab}/>
      <div style={{height:14}}/>

      {tab==="watching"&&(
        <>
          {watching.length===0&&<Card style={{padding:"40px 20px",textAlign:"center"}}><div style={{fontSize:44,marginBottom:8}}>⏱</div><div style={{fontWeight:600,color:T.textSecondary}}>No lots queued</div><div style={{fontSize:13,color:T.textMuted,marginTop:4}}>Score a lot in Bid Radar to add it here.</div></Card>}
          {watching.map((item,idx)=>{
            const target=item.saleTimestamp?new Date(item.saleTimestamp).getTime():null;
            const cd=target?fmtCountdown(target):"No time set";
            const urgent=target&&(target-Date.now())<86400000;
            const sc=item.dealScore||0;
            const estProfit=item.retail&&item.maxBid?item.retail*0.82-item.maxBid-2500:0;
            const scColor=sc>=85?T.green:sc>=70?T.amber:T.red;
            return(
              <Card key={item.id} style={{marginBottom:12}}>
                <div style={{padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                        <div style={{background:T.amberBg,color:T.amber,borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}}>#{idx+1}</div>
                        <div style={{fontWeight:700,fontSize:14,color:T.textPrimary}}>{item.year} {item.make} {item.model}</div>
                      </div>
                      <div style={{fontSize:11,color:T.textMuted}}>{item.source} · Lot {item.lot}</div>
                    </div>
                    {sc>0&&<div style={{background:`${scColor}22`,borderRadius:10,padding:"6px 10px",textAlign:"center",flexShrink:0}}><div style={{fontSize:20,fontWeight:900,color:scColor,lineHeight:1}}>{sc}</div><div style={{fontSize:9,color:T.textMuted,marginTop:1}}>score</div></div>}
                  </div>
                </div>
                <div style={{background:T.bg,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`}}>
                  <span style={{fontSize:11,color:T.textMuted}}>Sale in</span>
                  <span style={{fontSize:14,fontWeight:800,color:urgent?"#F87171":T.amber,fontVariantNumeric:"tabular-nums"}}>{cd}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
                  {[["Max bid",fmt(item.maxBid)],["Market retail",fmt(item.retail)],["Est. profit",fmt(Math.max(0,estProfit))]].map(([l,v],i,arr)=>(
                    <div key={l} style={{padding:"10px 10px",borderRight:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
                      <div style={{fontSize:10,color:T.textMuted,marginBottom:2}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:700,color:l==="Est. profit"?T.green:T.textPrimary}}>{v}</div>
                    </div>
                  ))}
                </div>
                {item.notes&&<div style={{padding:"8px 14px",fontSize:12,color:T.textMuted,borderTop:`1px solid ${T.border}`}}>{item.notes}</div>}
                <div style={{display:"flex",gap:8,padding:"10px 14px",borderTop:`1px solid ${T.border}`}}>
                  <button onClick={()=>onWon(item)} style={{flex:1,background:T.greenBg,color:T.green,border:`1px solid ${T.green}44`,borderRadius:10,padding:"10px 8px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Won ✓</button>
                  <button onClick={()=>{setLossModal(item);setLossForm({reasons:[],hammer:"",ceiling:String(item.maxBid||""),notes:""}); }} style={{flex:1,background:T.redBg,color:T.red,border:`1px solid ${T.red}44`,borderRadius:10,padding:"10px 8px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Lost ✗</button>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {tab==="won"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <Card style={{padding:"14px 16px"}}><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Lots won</div><div style={{fontSize:28,fontWeight:800,color:T.green}}>{won.length}</div></Card>
            <Card style={{padding:"14px 16px"}}><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Capital deployed</div><div style={{fontSize:20,fontWeight:800,color:T.blue}}>{fmt(won.reduce((s,i)=>s+Number(i.maxBid||0),0))}</div></Card>
          </div>
          {won.length===0&&<Card style={{padding:"40px 20px",textAlign:"center"}}><p style={{color:T.textSecondary,fontWeight:600}}>No wins logged yet.</p></Card>}
          {won.map(item=>(
            <Card key={item.id} style={{padding:"13px 16px",marginBottom:10,border:`1px solid ${T.green}44`}}>
              <div style={{fontWeight:700,fontSize:14,color:T.textPrimary}}>{item.year} {item.make} {item.model}</div>
              <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{item.source} · Lot {item.lot}</div>
              <div style={{fontSize:13,fontWeight:700,color:T.green,marginTop:8}}>Won — added to inventory ✓</div>
            </Card>
          ))}
        </>
      )}

      {tab==="lost"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <Card style={{padding:"14px 16px"}}><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Lots lost</div><div style={{fontSize:28,fontWeight:800,color:T.red}}>{lossLog.length}</div></Card>
            <Card style={{padding:"14px 16px"}}><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Top reason</div><div style={{fontSize:13,fontWeight:800,color:T.amber,marginTop:4,lineHeight:1.3}}>{topReason}</div></Card>
          </div>
          {lossLog.length>=2&&<div style={{background:T.amberBg,border:`1px solid ${T.amber}44`,borderRadius:12,padding:"12px 14px",marginBottom:14}}><div style={{fontWeight:700,color:T.amber,fontSize:13,marginBottom:4}}>💡 Pattern detected</div><div style={{fontSize:12,color:T.textSecondary}}>Most common loss: "{topReason}". Review your bid ceiling strategy for affected vehicle types.</div></div>}
          {lossLog.length===0&&<Card style={{padding:"40px 20px",textAlign:"center"}}><p style={{color:T.textSecondary,fontWeight:600}}>No losses logged yet.</p></Card>}
          {lossLog.map(l=>{
            const diff=l.hammer&&l.ceiling?l.hammer-l.ceiling:0;
            return(
              <Card key={l.id} style={{padding:"13px 16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div><div style={{fontWeight:700,fontSize:13,color:T.textPrimary}}>{l.vehicle}</div><div style={{fontSize:11,color:T.textMuted}}>{l.source}</div></div>
                  <Pill color={T.red} bg={T.redBg}>{(l.reasons||[])[0]||"Unknown"}</Pill>
                </div>
                {l.hammer>0&&<div style={{fontSize:12,color:T.textMuted,marginTop:8}}>Ceiling: {fmt(l.ceiling)} · Hammer: {fmt(l.hammer)}{diff>0?` · Missed by ${fmt(diff)}`:""}</div>}
                {l.notes&&<div style={{fontSize:12,color:T.textSecondary,marginTop:6,fontStyle:"italic"}}>{l.notes}</div>}
              </Card>
            );
          })}
        </>
      )}

      {lossModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setLossModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:"20px 16px 40px",maxHeight:"80vh",overflowY:"auto",border:`1px solid ${T.border}`}}>
            <div style={{width:36,height:4,background:T.border,borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{fontSize:16,fontWeight:800,color:T.textPrimary,marginBottom:4}}>Log loss</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:14}}>{lossModal.year} {lossModal.make} {lossModal.model}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {REASONS.map(r=>{const on=lossForm.reasons.includes(r);return(<button key={r} onClick={()=>toggleR(r)} style={{padding:"10px 8px",border:`1px solid ${on?T.red:T.border}`,borderRadius:10,background:on?T.redBg:T.surfaceHi,cursor:"pointer",fontSize:12,fontWeight:600,color:on?T.red:T.textSecondary,textAlign:"center"}}>{r}</button>);})}
            </div>
            {lossErr&&<p style={{color:T.red,fontSize:12,marginBottom:8}}>{lossErr}</p>}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Inp label="Actual hammer price ($)" value={lossForm.hammer} onChange={v=>setLossForm(p=>({...p,hammer:v}))} type="number" placeholder="What did it sell for?"/>
              <Inp label="Your ceiling ($)" value={lossForm.ceiling} onChange={v=>setLossForm(p=>({...p,ceiling:v}))} type="number" placeholder="What were you willing to pay?"/>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <label style={{fontSize:12,fontWeight:600,color:T.textSecondary}}>Notes</label>
                <textarea value={lossForm.notes} onChange={e=>setLossForm(p=>({...p,notes:e.target.value}))} style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.textPrimary,fontSize:14,outline:"none",resize:"none",height:72,lineHeight:1.5}} placeholder="What would you do differently?"/>
              </div>
              <Btn full color={T.amber} onClick={submitLoss} disabled={saving}>{saving?"Saving…":"Save to loss log"}</Btn>
              <Btn full outline color={T.textSecondary} onClick={()=>setLossModal(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inspection ────────────────────────────────────────────────────────────────
function InspectionView({v,onSave,saving}){
  const[tab,setTab]=useState("inspect");
  const[open,setOpen]=useState({});
  const[state,setState]=useState({});
  const[customIn,setCustomIn]=useState({});
  const[customSev,setCustomSev]=useState({});
  const[customItems,setCustomItems]=useState({});
  const[odo,setOdo]=useState("");
  const[shop,setShop]=useState("");
  const[targetDate,setTargetDate]=useState("");
  const[notes,setNotes]=useState("");
  const[saved,setSaved]=useState(false);

  function setSev(key,sev){setState(p=>({...p,[key]:sev}));}
  function getFlagged(id){return Object.entries(state).filter(([k,v])=>k.startsWith(id+"|")&&v&&v!=="none").length;}
  function getLabel(k){return k.split("|")[1]?.replace(/_c_[a-z0-9]+$/,"");}
  function addCustom(secId){
    const name=(customIn[secId]||"").trim(),sev=customSev[secId]||"replace";
    if(!name)return;
    const key=`${secId}|${name}_c_${uid()}`;
    setState(p=>({...p,[key]:sev}));
    setCustomItems(p=>({...p,[secId]:[...(p[secId]||[]),{key,name}]}));
    setCustomIn(p=>({...p,[secId]:""}));
  }

  const replace=Object.entries(state).filter(([,v])=>v==="replace");
  const repair=Object.entries(state).filter(([,v])=>v==="repair");
  const monitor=Object.entries(state).filter(([,v])=>v==="monitor");
  const SEV={ok:{bg:T.greenBg,c:T.green,l:"OK"},monitor:{bg:T.blueBg,c:T.blue,l:"Monitor"},repair:{bg:T.amberBg,c:T.amber,l:"Repair"},replace:{bg:T.redBg,c:T.red,l:"Replace"}};

  async function handleSave(){await onSave({items:state,odo,shop,targetDate,notes});setSaved(true);setTimeout(()=>setSaved(false),2500);}

  return(
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:800,color:T.textPrimary}}>Intake inspection</div>
        <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>{v.year} {v.make} {v.model}</div>
      </div>
      <Tabs tabs={[{id:"inspect",label:"Inspection"},{id:"summary",label:"Parts summary"},{id:"notes",label:"Notes"}]} active={tab} onChange={setTab}/>
      <div style={{height:14}}/>

      {tab==="inspect"&&(
        <>
          <div style={{fontSize:11,color:T.textSecondary,marginBottom:12}}>Tap condition buttons for each item. Replace items go straight to your parts order list.</div>
          {INSPECT_SECTIONS.map(sec=>{
            const flagged=getFlagged(sec.id),isOpen=open[sec.id];
            return(
              <Card key={sec.id} style={{marginBottom:10}}>
                <button onClick={()=>setOpen(p=>({...p,[sec.id]:!p[sec.id]}))} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>
                  <span style={{fontSize:20,flexShrink:0}}>{sec.emoji}</span>
                  <span style={{fontWeight:700,fontSize:13,color:T.textPrimary,flex:1}}>{sec.label}</span>
                  {flagged>0&&<Pill color={T.amber} bg={T.amberBg}>{flagged} flagged</Pill>}
                  <span style={{color:T.textMuted,fontSize:14}}>{isOpen?"▲":"▼"}</span>
                </button>
                {isOpen&&(
                  <>
                    {sec.items.map(item=>{
                      const key=`${sec.id}|${item}`,cur=state[key]||"none";
                      return(
                        <div key={item} style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:12,color:T.textPrimary,flex:1}}>{item}</span>
                          <div style={{display:"flex",gap:4,flexShrink:0}}>
                            {["ok","monitor","repair","replace"].map(s=>{const ss=SEV[s],on=cur===s;return(<button key={s} onClick={()=>setSev(key,on?"none":s)} style={{padding:"5px 7px",border:`1px solid ${on?ss.c:T.border}`,borderRadius:7,background:on?ss.bg:T.surfaceHi,color:on?ss.c:T.textMuted,fontSize:11,fontWeight:on?700:500,cursor:"pointer"}}>{ss.l}</button>);})}</div>
                        </div>
                      );
                    })}
                    {(customItems[sec.id]||[]).map(ci=>{const cur=state[ci.key]||"none";return(
                      <div key={ci.key} style={{padding:"10px 14px",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,background:T.bg}}>
                        <span style={{fontSize:12,color:T.textPrimary,flex:1}}>{ci.name} <span style={{fontSize:10,color:T.textMuted}}>(custom)</span></span>
                        <div style={{display:"flex",gap:4,flexShrink:0}}>
                          {["ok","monitor","repair","replace"].map(s=>{const ss=SEV[s],on=cur===s;return(<button key={s} onClick={()=>setSev(ci.key,on?"none":s)} style={{padding:"5px 7px",border:`1px solid ${on?ss.c:T.border}`,borderRadius:7,background:on?ss.bg:T.surfaceHi,color:on?ss.c:T.textMuted,fontSize:11,fontWeight:on?700:500,cursor:"pointer"}}>{ss.l}</button>);})}
                        </div>
                      </div>
                    );})}
                    <div style={{padding:"8px 14px",borderTop:`1px solid ${T.border}`,background:T.bg,display:"flex",gap:6}}>
                      <input value={customIn[sec.id]||""} onChange={e=>setCustomIn(p=>({...p,[sec.id]:e.target.value}))} placeholder="Add custom item…" style={{flex:1,background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 10px",fontSize:12,color:T.textPrimary,outline:"none"}}/>
                      <select value={customSev[sec.id]||"replace"} onChange={e=>setCustomSev(p=>({...p,[sec.id]:e.target.value}))} style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 8px",fontSize:12,color:T.textPrimary,outline:"none"}}>
                        <option value="replace">Replace</option><option value="repair">Repair</option><option value="monitor">Monitor</option><option value="ok">OK</option>
                      </select>
                      <button onClick={()=>addCustom(sec.id)} style={{background:T.amber,color:"#000",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,fontSize:12,cursor:"pointer"}}>Add</button>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
          <Btn full color={saved?T.green:T.amber} tc={saved?"#fff":"#000"} onClick={handleSave} disabled={saving}>{saved?"✅ Saved!":saving?"Saving…":"Save inspection"}</Btn>
        </>
      )}

      {tab==="summary"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <Card style={{padding:"14px 16px"}}><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Parts to order</div><div style={{fontSize:28,fontWeight:800,color:T.red}}>{replace.length}</div></Card>
            <Card style={{padding:"14px 16px"}}><div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Shop repairs</div><div style={{fontSize:28,fontWeight:800,color:T.amber}}>{repair.length}</div></Card>
          </div>
          {replace.length===0&&repair.length===0&&monitor.length===0
            ?<Card style={{padding:"32px 20px",textAlign:"center"}}><p style={{color:T.textSecondary}}>Complete the inspection first.</p></Card>
            :<Card>
              {replace.length>0&&<><div style={{padding:"10px 14px",background:T.redBg}}><span style={{fontSize:11,fontWeight:700,color:T.red}}>Parts to order (replace)</span></div>{replace.map(([k])=><div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderTop:`1px solid ${T.border}`}}><span style={{fontSize:13,color:T.textPrimary}}>{getLabel(k)}</span><Pill color={T.red} bg={T.redBg}>Replace</Pill></div>)}</>}
              {repair.length>0&&<><div style={{padding:"10px 14px",background:T.amberBg,borderTop:`1px solid ${T.border}`}}><span style={{fontSize:11,fontWeight:700,color:T.amber}}>Shop repairs</span></div>{repair.map(([k])=><div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderTop:`1px solid ${T.border}`}}><span style={{fontSize:13,color:T.textPrimary}}>{getLabel(k)}</span><Pill color={T.amber} bg={T.amberBg}>Repair</Pill></div>)}</>}
              {monitor.length>0&&<><div style={{padding:"10px 14px",background:T.blueBg,borderTop:`1px solid ${T.border}`}}><span style={{fontSize:11,fontWeight:700,color:T.blue}}>Monitor</span></div>{monitor.map(([k])=><div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderTop:`1px solid ${T.border}`}}><span style={{fontSize:13,color:T.textPrimary}}>{getLabel(k)}</span><Pill color={T.blue} bg={T.blueBg}>Monitor</Pill></div>)}</>}
            </Card>}
        </>
      )}

      {tab==="notes"&&(
        <Card style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
          <Inp label="Odometer on arrival (km)" value={odo} onChange={setOdo} type="number" placeholder="87420"/>
          <Inp label="Assigned to (tech or shop)" value={shop} onChange={setShop} placeholder="Shop name or technician"/>
          <Inp label="Target completion date" value={targetDate} onChange={setTargetDate} type="date"/>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:12,fontWeight:600,color:T.textSecondary}}>Inspector notes</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.textPrimary,fontSize:14,outline:"none",resize:"none",height:120,lineHeight:1.5}} placeholder="Condition, concerns, anything the tech should know…"/>
          </div>
          <Btn full color={saved?T.green:T.amber} tc={saved?"#fff":"#000"} onClick={handleSave} disabled={saving}>{saved?"Saved!":saving?"Saving…":"Save notes"}</Btn>
        </Card>
      )}
    </div>
  );
}

// ── Add Vehicle ───────────────────────────────────────────────────────────────
function AddVehicleView({onSave,saving}){
  const[form,setForm]=useState({year:"",make:"",model:"",trim:"",vin:"",mileage:"",purchaseDate:today(),purchasePrice:"",estimatedSale:""});
  const[scanning,setScanning]=useState(false);
  const[scanErr,setScanErr]=useState("");
  const[scanResult,setScanResult]=useState(null);
  const[scanDoc,setScanDoc]=useState(null);
  const sf=(k,v)=>setForm(p=>({...p,[k]:v}));
  const models=form.make?Object.keys(VEHICLE_DB[form.make]||{}).sort():[];
  const trims=(form.make&&form.model)?(VEHICLE_DB[form.make]?.[form.model]||[]):[];
  function mMake(r){if(!r)return"";const u=r.toUpperCase();return MAKES.find(m=>u.includes(m.toUpperCase()))||"";}
  function mModel(make,r){if(!make||!r)return"";const u=r.toUpperCase();return Object.keys(VEHICLE_DB[make]||{}).find(m=>u.includes(m.toUpperCase()))||"";}
  function mTrim(make,model,r){if(!make||!model||!r)return"";const u=r.toUpperCase();return(VEHICLE_DB[make]?.[model]||[]).find(t=>u.includes(t.toUpperCase()))||"";}

  async function scanDoc2(file){
    setScanning(true);setScanErr("");setScanResult(null);
    try{
      const url=await fileToUrl(file);const base64=url.split(",")[1];const isPdf=file.type==="application/pdf";
      setScanDoc({dataUrl:url,name:file.name||(isPdf?"doc.pdf":"doc.jpg"),isPdf});
      const cb=isPdf?{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}}:{type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}};
      const resp=await fetch("/api/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:[cb,{type:"text",text:`Extract vehicle purchase details. Return ONLY valid JSON:\n{"year":"4-digit year","make":"manufacturer","model":"model name","trim":"trim or empty","vin":"17-char VIN or empty","mileage":"digits only or empty","purchaseDate":"YYYY-MM-DD or empty","purchasePrice":number or 0}`}]})});
      if(!resp.ok)throw new Error(`Error ${resp.status}`);
      const data=await resp.json();
      const text=(data.content||[]).map(b=>b.text||"").join("").trim();
      const parsed=JSON.parse(text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim());
      const filled=[],updates={};
      if(parsed.year&&YEARS.includes(parsed.year)){updates.year=parsed.year;filled.push("Year");}
      const mk=mMake(parsed.make);if(mk){updates.make=mk;filled.push("Make");}
      const mo=mModel(mk,parsed.model);if(mo){updates.model=mo;filled.push("Model");}
      const tr=mTrim(mk,mo,parsed.trim);if(tr){updates.trim=tr;filled.push("Trim");}
      if(parsed.vin&&parsed.vin.length===17){updates.vin=parsed.vin;filled.push("VIN");}
      if(parsed.mileage&&Number(parsed.mileage)>0){updates.mileage=String(parsed.mileage);filled.push("Mileage");}
      if(parsed.purchaseDate){updates.purchaseDate=parsed.purchaseDate;filled.push("Date");}
      if(parsed.purchasePrice&&Number(parsed.purchasePrice)>0){updates.purchasePrice=String(parsed.purchasePrice);filled.push("Price");}
      setForm(p=>({...p,...updates}));
      setScanResult({summary:`Auto-filled ${filled.length} field${filled.length!==1?"s":""}`,details:filled.join(", ")});
      if(!filled.length)setScanErr("No vehicle details found. Fill in manually.");
    }catch(e){setScanErr(e.message||"Could not read document.");}
    finally{setScanning(false);}
  }

  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,marginBottom:16}}>Add vehicle</div>
      <AIScanner title="AI Document Scanner" desc="Upload your Copart/IAA bill of sale — AI reads it and fills the form." onFile={scanDoc2} scanning={scanning} error={scanErr} result={scanResult} onApply={()=>setScanResult(null)} files={scanDoc?[scanDoc]:[]}/>
      <Card style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
        <Sel label="Year" value={form.year} options={YEARS} onChange={v=>sf("year",v)} placeholder="Select year…"/>
        <Sel label="Make" value={form.make} options={MAKES} onChange={v=>{sf("make",v);sf("model","");sf("trim","");}} placeholder="Select make…"/>
        <Sel label="Model" value={form.model} options={models} onChange={v=>{sf("model",v);sf("trim","");}} placeholder={form.make?"Select model…":"Select make first"}/>
        <Sel label="Trim" value={form.trim} options={trims} onChange={v=>sf("trim",v)} placeholder={trims.length?"Select trim…":"Select model first"}/>
        <Inp label="VIN" value={form.vin} onChange={v=>sf("vin",v)} placeholder="1HGCM82633A123456"/>
        <Inp label="Mileage (km)" value={form.mileage} onChange={v=>sf("mileage",v)} placeholder="142000" type="number"/>
        <Inp label="Purchase date" value={form.purchaseDate} onChange={v=>sf("purchaseDate",v)} type="date"/>
        <Inp label="Purchase price ($)" value={String(form.purchasePrice)} onChange={v=>sf("purchasePrice",v)} placeholder="5400" type="number"/>
        <Inp label="Estimated sale price ($)" value={String(form.estimatedSale)} onChange={v=>sf("estimatedSale",v)} placeholder="10000" type="number"/>
        <Btn full color={T.amber} size="lg" disabled={saving} onClick={()=>{
          if(!form.year||!form.make||!form.model||!form.purchasePrice){alert("Year, Make, Model and Purchase Price are required.");return;}
          onSave({...form,purchasePrice:Number(form.purchasePrice),mileage:Number(form.mileage)||0,estimatedSale:Number(form.estimatedSale)||0});
        }}>{saving?"Saving…":"Add vehicle"}</Btn>
      </Card>
    </div>
  );
}

// ── Add Expense ───────────────────────────────────────────────────────────────
function AddExpenseView({v,onSave,saving}){
  const[cat,setCat]=useState("Mechanical");
  const[item,setItem]=useState("Battery");
  const[custom,setCustom]=useState("");
  const[amount,setAmount]=useState("");
  const[vendor,setVendor]=useState("");
  const[date,setDate]=useState(today());
  const[note,setNote]=useState("");
  const[receipts,setReceipts]=useState([]);
  const[scanning,setScanning]=useState(false);
  const[scanResult,setScanResult]=useState(null);
  const[scanRaw,setScanRaw]=useState(null);
  const[scanErr,setScanErr]=useState("");
  const isCustom=item==="Custom...";

  async function processFile(file){
    setScanning(true);setScanErr("");setScanResult(null);setScanRaw(null);
    try{
      const url=await fileToUrl(file);const isPdf=file.type==="application/pdf";
      const base64=url.split(",")[1];const mt=isPdf?"application/pdf":"image/jpeg";
      let stored=null;let lid=null;
      if(isPdf){lid=uid();saveLocal(lid,url);}
      else{let c=await compressImg(url,800,0.7);if(c.length*3/4>200*1024)c=await compressImg(url,600,0.5);stored=c;}
      setReceipts(p=>[...p,{dataUrl:isPdf?url:stored,firestoreDataUrl:stored,localId:lid,name:file.name||"receipt",type:mt,isPdf}]);
      const cb=isPdf?{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}}:{type:"image",source:{type:"base64",media_type:mt,data:base64}};
      const resp=await fetch("/api/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:[cb,{type:"text",text:`Scan this automotive receipt. Return ONLY valid JSON:\n{"vendor":"store name","date":"YYYY-MM-DD or empty","amount":number,"item":"part or service name","category":"Mechanical|Exterior|Tires & Wheels|Fluids|Labor|Fees|Other","note":"key details"}`}]})});
      if(!resp.ok)throw new Error(`Error ${resp.status}`);
      const data=await resp.json();
      const text=(data.content||[]).map(b=>b.text||"").join("").trim();
      const parsed=JSON.parse(text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim());
      setScanRaw(parsed);setScanResult({summary:`Found: ${parsed.item} — $${parsed.amount}`,details:parsed.vendor||""});
    }catch(e){setScanErr(e.message||"Could not read receipt.");}
    finally{setScanning(false);}
  }

  function applyResult(){
    if(!scanRaw)return;
    if(scanRaw.vendor)setVendor(scanRaw.vendor);
    if(scanRaw.date)setDate(scanRaw.date);
    if(scanRaw.amount)setAmount(String(scanRaw.amount));
    if(scanRaw.note)setNote(scanRaw.note);
    if(scanRaw.category&&EXPENSE_CATS[scanRaw.category]){setCat(scanRaw.category);const m=EXPENSE_CATS[scanRaw.category].find(i=>i===scanRaw.item);if(m)setItem(m);}
    setScanResult(null);setScanRaw(null);
  }

  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,marginBottom:4}}>Add expense</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>{v.year} {v.make} {v.model}</div>
      <AIScanner title="AI Receipt Scanner" desc="Take a photo or upload a receipt — AI reads it and fills the form." onFile={processFile} scanning={scanning} error={scanErr} result={scanResult} onApply={applyResult} files={receipts} onRemove={i=>setReceipts(p=>p.filter((_,idx)=>idx!==i))}/>
      <Card style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <label style={{fontSize:12,fontWeight:600,color:T.textSecondary,display:"block",marginBottom:8}}>Category</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {Object.keys(EXPENSE_CATS).map(c=><button key={c} onClick={()=>{setCat(c);setItem(EXPENSE_CATS[c][0]);}} style={{background:cat===c?T.amberBg:T.surfaceHi,color:cat===c?T.amber:T.textMuted,border:`1px solid ${cat===c?T.amber:T.border}`,padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer"}}>{c}</button>)}
          </div>
        </div>
        <Sel label="Item" value={item} options={EXPENSE_CATS[cat]||[]} onChange={setItem}/>
        {isCustom&&<Inp label="Describe item" value={custom} onChange={setCustom} placeholder="e.g. Door lock actuator"/>}
        <Inp label="Amount ($)" value={amount} onChange={setAmount} placeholder="275" type="number"/>
        <Inp label="Vendor / shop" value={vendor} onChange={setVendor} placeholder="Canadian Tire, Napa…"/>
        <Inp label="Date" value={date} onChange={setDate} type="date"/>
        <Inp label="Notes (optional)" value={note} onChange={setNote} placeholder="Used part, set of 4…"/>
        <Btn full color={T.amber} size="lg" disabled={saving} onClick={()=>{
          const fi=isCustom?custom:item;
          if(!fi||!amount){alert("Item and amount are required.");return;}
          const fr=receipts.map(r=>({name:r.name,type:r.type,isPdf:r.isPdf||false,localId:r.localId||null,dataUrl:r.firestoreDataUrl||(r.isPdf?null:r.dataUrl)||null}));
          onSave({category:cat,item:fi,amount:Number(amount),vendor,date,note,receipts:fr});
        }}>{saving?"Saving…":"Save expense"}</Btn>
      </Card>
    </div>
  );
}

// ── Sell ──────────────────────────────────────────────────────────────────────
function SellView({v,onSave,saving}){
  const{cost}=calcV(v);
  const[price,setPrice]=useState(v.estimatedSale||"");
  const[date,setDate]=useState(today());
  const[hst,setHst]=useState(false);
  const profit=Number(price)-cost,margin=cost>0?(profit/cost)*100:0;
  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,marginBottom:16}}>Mark as sold</div>
      <Card style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:T.surfaceHi,borderRadius:12,padding:14}}>
          <div style={{fontWeight:700,color:T.textPrimary}}>{v.year} {v.make} {v.model}</div>
          <div style={{fontSize:12,color:T.textMuted,marginTop:2}}>Total invested: {fmt(cost)}</div>
        </div>
        <Inp label="Sale price ($)" value={String(price)} onChange={setPrice} placeholder="10000" type="number"/>
        <Inp label="Sale date" value={date} onChange={setDate} type="date"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.surfaceHi,borderRadius:10,padding:"12px 14px"}}>
          <div><div style={{fontWeight:600,fontSize:13,color:T.textPrimary}}>HST collected?</div><div style={{fontSize:11,color:T.textMuted}}>Did you charge HST on this sale?</div></div>
          <button onClick={()=>setHst(p=>!p)} style={{background:hst?T.green:"#334155",border:"none",borderRadius:20,width:42,height:24,cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
            <div style={{position:"absolute",top:3,left:hst?21:3,width:18,height:18,background:"#fff",borderRadius:"50%",transition:"left 0.2s"}}/>
          </button>
        </div>
        {hst&&Number(price)>0&&<div style={{background:T.greenBg,borderRadius:10,padding:12,fontSize:13,color:T.green,fontWeight:600}}>HST to remit to CRA: {fmtD(Number(price)*HST_RATE)}</div>}
        {Number(price)>0&&(
          <div style={{background:profit>=0?T.greenBg:T.redBg,border:`1px solid ${profit>=0?T.green:T.red}44`,borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:14}}>
            <Ring margin={margin} size={52}/>
            <div><div style={{fontSize:11,color:T.textMuted}}>Net profit</div><div style={{fontSize:28,fontWeight:900,color:profit>=0?T.green:T.red,letterSpacing:-0.5}}>{fmt(profit)}</div><div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{margin.toFixed(1)}% margin</div></div>
          </div>
        )}
        <Btn full color={T.green} tc="#fff" size="lg" disabled={saving} onClick={()=>{if(!price){alert("Enter a sale price.");return;}onSave({salePrice:Number(price),soldDate:date,hstCollected:hst,hstAmount:hst?Number(price)*HST_RATE:0});}}>{saving?"Saving…":"Confirm sale"}</Btn>
      </Card>
    </div>
  );
}

// ── Edit vehicle ──────────────────────────────────────────────────────────────
function EditVehicleView({v,onSave,saving}){
  const[form,setForm]=useState({year:v.year||"",make:v.make||"",model:v.model||"",trim:v.trim||"",vin:v.vin||"",mileage:String(v.mileage||""),purchaseDate:v.purchaseDate||today(),purchasePrice:String(v.purchasePrice||""),estimatedSale:String(v.estimatedSale||""),status:v.status||"In Repair"});
  const sf=(k,val)=>setForm(p=>({...p,[k]:val}));
  const models=form.make?Object.keys(VEHICLE_DB[form.make]||{}).sort():[];
  const trims=(form.make&&form.model)?(VEHICLE_DB[form.make]?.[form.model]||[]):[];
  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,marginBottom:4}}>Edit vehicle</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>{v.year} {v.make} {v.model}</div>
      <Card style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
        <Sel label="Year" value={form.year} options={YEARS} onChange={val=>sf("year",val)}/>
        <Sel label="Make" value={form.make} options={MAKES} onChange={val=>{sf("make",val);sf("model","");sf("trim","");}}/>
        <Sel label="Model" value={form.model} options={models} onChange={val=>{sf("model",val);sf("trim","");}}/>
        <Sel label="Trim" value={form.trim} options={trims} onChange={val=>sf("trim",val)}/>
        <Inp label="VIN" value={form.vin} onChange={val=>sf("vin",val)} placeholder="1HGCM82633A123456"/>
        <Inp label="Mileage (km)" value={form.mileage} onChange={val=>sf("mileage",val)} type="number"/>
        <Inp label="Purchase date" value={form.purchaseDate} onChange={val=>sf("purchaseDate",val)} type="date"/>
        <Inp label="Purchase price ($)" value={form.purchasePrice} onChange={val=>sf("purchasePrice",val)} type="number"/>
        <Inp label="Est. sale price ($)" value={form.estimatedSale} onChange={val=>sf("estimatedSale",val)} type="number"/>
        <div>
          <label style={{fontSize:12,fontWeight:600,color:T.textSecondary,display:"block",marginBottom:8}}>Status</label>
          <div style={{display:"flex",gap:8}}>
            {["In Repair","Available","Sold"].map(s=>{const sc=STATUS_CFG[s],on=form.status===s;return<button key={s} onClick={()=>sf("status",s)} style={{flex:1,background:on?sc.bg:T.surfaceHi,color:on?sc.color:T.textMuted,border:`2px solid ${on?sc.color:T.border}`,padding:"10px 6px",borderRadius:10,fontWeight:700,fontSize:12,cursor:"pointer"}}>{sc.emoji} {s}</button>;})}
          </div>
        </div>
        <Btn full color={T.amber} size="lg" disabled={saving} onClick={()=>{
          if(!form.year||!form.make||!form.model||!form.purchasePrice){alert("Year, Make, Model and Purchase Price are required.");return;}
          onSave({year:form.year,make:form.make,model:form.model,trim:form.trim,vin:form.vin,mileage:Number(form.mileage)||0,purchaseDate:form.purchaseDate,purchasePrice:Number(form.purchasePrice),estimatedSale:Number(form.estimatedSale)||0,status:form.status});
        }}>{saving?"Saving…":"Save changes"}</Btn>
      </Card>
    </div>
  );
}

// ── Notes ─────────────────────────────────────────────────────────────────────
function NotesView({v,onSave}){
  const[notes,setNotes]=useState(v.notes||"");
  const[saved,setSaved]=useState(false);
  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,marginBottom:4}}>Notes</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>{v.year} {v.make} {v.model}</div>
      <Card style={{padding:16}}>
        <label style={{fontSize:12,fontWeight:600,color:T.textSecondary,display:"block",marginBottom:8}}>Vehicle notes</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Interested buyer at $9,500, waiting on parts, follow up Friday…" style={{background:T.surfaceHi,border:`1px solid ${T.border}`,borderRadius:10,padding:"11px 14px",color:T.textPrimary,fontSize:14,outline:"none",resize:"vertical",height:200,lineHeight:1.6,width:"100%",boxSizing:"border-box"}}/>
        <div style={{marginTop:12}}>
          <Btn full color={saved?T.green:T.amber} tc={saved?"#fff":"#000"} onClick={async()=>{await onSave(notes);setSaved(true);setTimeout(()=>setSaved(false),2000);}}>{saved?"✅ Saved!":"Save notes"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── Document vault ────────────────────────────────────────────────────────────
function DocsView({v,onReceipt}){
  const receipts=allReceipts(v);
  return(
    <div>
      <div style={{fontSize:20,fontWeight:800,color:T.textPrimary,marginBottom:4}}>Document vault</div>
      <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>{v.year} {v.make} {v.model} · {receipts.length} document{receipts.length!==1?"s":""}</div>
      {receipts.length===0
        ?<Card style={{padding:"40px 20px",textAlign:"center"}}><div style={{fontSize:44}}>📁</div><p style={{color:T.textSecondary,fontWeight:600,marginTop:8}}>No documents yet</p><p style={{fontSize:13,color:T.textMuted}}>Upload receipts when adding expenses.</p></Card>
        :<>
          <Btn full color={T.green} tc="#fff" onClick={()=>receipts.forEach((r,i)=>setTimeout(()=>{if(r.dataUrl)dlUrl(r.dataUrl,r.name||`receipt-${i+1}`);},i*200))} style={{marginBottom:12}}>Download all ({receipts.length})</Btn>
          <Card>
            {receipts.map((r,i)=>{
              const isPdf=r.type==="application/pdf"||r.name?.endsWith(".pdf"),fn=r.name||`receipt-${i+1}`;
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:i<receipts.length-1?`1px solid ${T.border}`:"none"}}>
                  <div onClick={()=>{const src=r.isPdf?(r.localId?loadLocal(r.localId):null):r.dataUrl;onReceipt({dataUrl:src,name:fn,isPdf:r.isPdf});}} style={{width:52,height:52,borderRadius:10,border:`1px solid ${T.border}`,background:T.surfaceHi,overflow:"hidden",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {isPdf?<span style={{fontSize:24}}>📄</span>:<img src={r.dataUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:T.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.expItem}</div>
                    <div style={{fontSize:11,color:T.textMuted}}>{r.expVendor||"—"} · {r.expDate}</div>
                    <div style={{fontSize:11,color:T.textMuted}}>{isPdf?"PDF":"Image"} · {fn}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>{const src=r.isPdf?(r.localId?loadLocal(r.localId):null):r.dataUrl;onReceipt({dataUrl:src,name:fn,isPdf:r.isPdf});}} style={{background:T.blueBg,border:"none",borderRadius:8,padding:"8px 10px",cursor:"pointer",color:T.blue,fontSize:14}}>👁</button>
                    <button onClick={()=>{const src=r.isPdf?(r.localId?loadLocal(r.localId):null):r.dataUrl;if(!src){alert("File not available.");return;}dlUrl(src,fn);}} style={{background:T.greenBg,border:"none",borderRadius:8,padding:"8px 10px",cursor:"pointer",color:T.green,fontSize:14}}>↓</button>
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      }
    </div>
  );
}
