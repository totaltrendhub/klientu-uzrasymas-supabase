import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function diffMinutes(a,b){ const [ah,am]=a.split(":").map(Number); const [bh,bm]=b.split(":").map(Number); return (bh*60+bm)-(ah*60+am); }

export default function Stats({ services }){
  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(""); // YYYY-MM or ""
  const [gender, setGender] = useState(""); // "", "female", "male"
  const [category, setCategory] = useState(""); // "", "Dažymas", ...

  useEffect(()=>{
    async function load(){
      const { data } = await supabase.from("appointments").select("*, services(category), clients(gender)").order("date",{ascending:true}).order("start_time");
      setItems(data||[]);
    }
    load();
  },[]);

  // filtras: status == attended
  let filtered = items.filter(a=>a.status==="attended");
  if(month){
    filtered = filtered.filter(a=> (a.date||"").slice(0,7)===month);
  }
  if(gender){
    filtered = filtered.filter(a=> (a.clients?.gender||"")===gender);
  }
  if(category){
    filtered = filtered.filter(a=> (a.services?.category||a.category)===category);
  }

  const visits = filtered.length;
  const revenue = filtered.reduce((s,a)=>s+(Number(a.price)||0),0);
  const minutes = filtered.reduce((s,a)=>s+Math.max(0,diffMinutes(a.start_time.slice(0,5), a.end_time.slice(0,5))),0);
  const avgPrice = visits ? (revenue/visits) : 0;

  const noShow = items.filter(a=>a.status==="no_show").length;
  const okPlusNoShow = items.filter(a=>a.status==="attended"||a.status==="no_show").length;
  const noShowPct = okPlusNoShow ? (noShow*100/okPlusNoShow) : 0;

  // revenue last 30 d. from filtered items
  const now = new Date();
  const last30Entries = filtered.filter(a=>{
    const d = new Date(a.date);
    return (now - d) / (1000*60*60*24) <= 30;
  }).reduce((map,a)=>{ map[a.date]=(map[a.date]||0)+(Number(a.price)||0); return map; }, {});
  const last30 = Object.entries(last30Entries).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxRev = Math.max(1, ...last30.map(x=>x[1]));
  const width = 520, height = 140, padding = 20;
  const points = last30.map(([,v],i)=>{
    const x = padding + (i * ( (width-2*padding) / Math.max(1,last30.length-1) ));
    const y = height - padding - (v/maxRev)*(height-2*padding);
    return [x,y];
  });
  const path = points.map((p,i)=> (i===0? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`)).join(" ");

  // categories options from services
  const categories = Array.from(new Set((services||[]).map(s=>s.category)));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Mėnuo</div>
            <div className="flex items-center gap-2">
              <input type="month" className="px-3 py-2 rounded-xl border w-full" value={month} onChange={e=>setMonth(e.target.value)} />
              {month && <button onClick={()=>setMonth("")} className="px-2 py-2 rounded-xl border">Išvalyti</button>}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Kategorija</div>
            <select className="px-3 py-2 rounded-xl border w-full" value={category} onChange={e=>setCategory(e.target.value)}>
              <option value="">Visos</option>
              {categories.map(c=>(<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Lytis</div>
            <select className="px-3 py-2 rounded-xl border w-full" value={gender} onChange={e=>setGender(e.target.value)}>
              <option value="">Visi</option>
              <option value="female">Moteris</option>
              <option value="male">Vyras</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-2xl shadow"><div className="text-sm text-gray-600">Vizitų</div><div className="text-2xl font-bold">{visits}</div></div>
        <div className="p-4 bg-white rounded-2xl shadow"><div className="text-sm text-gray-600">Uždarbis</div><div className="text-2xl font-bold">{revenue.toFixed(2)} €</div></div>
        <div className="p-4 bg-white rounded-2xl shadow"><div className="text-sm text-gray-600">Vid. kaina</div><div className="text-2xl font-bold">{avgPrice.toFixed(2)} €</div></div>
        <div className="p-4 bg-white rounded-2xl shadow"><div className="text-sm text-gray-600">Dirbta</div><div className="text-2xl font-bold">{Math.floor(minutes/60)} h {minutes%60} min</div></div>
        <div className="p-4 bg-white rounded-2xl shadow"><div className="text-sm text-gray-600">Neatvyko</div><div className="text-2xl font-bold">{noShow} ({noShowPct.toFixed(0)}%)</div></div>
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <div className="font-semibold mb-2">Pajamos per paskutines 30 d.</div>
        {last30.length===0 ? (
          <div className="text-gray-500">Nerasta duomenų pagal pasirinktus filtrus.</div>
        ) : (
          <svg width={width} height={height} className="w-full">
            <path d={path} fill="none" stroke="currentColor" className="text-emerald-600" strokeWidth="2" />
            {points.map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="3" className="fill-emerald-600" />))}
          </svg>
        )}
      </div>
    </div>
  );
}
