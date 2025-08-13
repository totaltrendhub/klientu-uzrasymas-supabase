import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import lt from "date-fns/locale/lt";

function diffMinutes(a,b){ const [ah,am]=a.split(":").map(Number); const [bh,bm]=b.split(":").map(Number); return (bh*60+bm)-(ah*60+am); }

function monthsOptions(n=12){
  const now = new Date();
  return Array.from({length:n}, (_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return { value: format(d,"yyyy-MM"), label: format(d,"LLLL yyyy",{ locale: lt }) };
  });
}

export default function Stats({ workspace }){
  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(format(new Date(),"yyyy-MM"));
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");

  useEffect(()=>{
    async function load(){
      const { data } = await supabase.from("appointments").select("*, services(category), clients(gender)").eq("workspace_id", workspace.id).order("date",{ascending:true}).order("start_time");
      setItems(data||[]);
    }
    load();
  },[workspace.id]);

  let filtered = items.filter(a=>a.status==="attended");
  if(month)   filtered = filtered.filter(a=> (a.date||"").slice(0,7)===month);
  if(gender)  filtered = filtered.filter(a=> (a.clients?.gender||"")===gender);
  if(category)filtered = filtered.filter(a=> (a.services?.category||a.category)===category);

  const visits = filtered.length;
  const revenue = filtered.reduce((s,a)=>s+(Number(a.price)||0),0);
  const minutes = filtered.reduce((s,a)=>s+Math.max(0,diffMinutes(a.start_time.slice(0,5), a.end_time.slice(0,5))),0);
  const avgPrice = visits ? (revenue/visits) : 0;

  const noShow = items.filter(a=>a.status==="no_show" && (a.date||"").slice(0,7)===month).length;
  const okPlusNoShow = items.filter(a=>["attended","no_show"].includes(a.status) && (a.date||"").slice(0,7)===month).length;
  const noShowPct = okPlusNoShow ? (noShow*100/okPlusNoShow) : 0;

  const d0 = parseISO(month+"-01");
  const dstart = startOfMonth(d0);
  const dend = endOfMonth(d0);
  const days = eachDayOfInterval({ start: dstart, end: dend });
  const perDay = days.map(d=>({ date: format(d,"yyyy-MM-dd"), sum: 0 }));
  filtered.forEach(a=>{
    const idx = perDay.findIndex(x=>x.date===a.date);
    if(idx>=0) perDay[idx].sum += Number(a.price)||0;
  });
  const maxY = Math.max(1, ...perDay.map(x=>x.sum));
  const yTicks = [0, maxY*0.25, maxY*0.5, maxY*0.75, maxY];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Mėnuo</div>
            <select className="px-3 py-2 rounded-xl border w-full" value={month} onChange={e=>setMonth(e.target.value)}>
              {monthsOptions(18).map(m=>(<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Kategorija</div>
            <select className="px-3 py-2 rounded-xl border w-full" value={category} onChange={e=>setCategory(e.target.value)}>
              <option value="">Visos</option>
              {[...new Set(items.map(x=>x.services?.category||x.category))].filter(Boolean).map(c=>(<option key={c} value={c}>{c}</option>))}
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

      <div className="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <div className="font-semibold mb-2">Pajamos per {format(d0,"LLLL yyyy",{ locale: lt })}</div>
        <svg width={Math.max(640, days.length*22)} height={240}>
          <line x1="40" y1="10" x2="40" y2="200" stroke="currentColor" opacity="0.4" />
          <line x1="40" y1="200" x2={Math.max(600, days.length*22)} y2="200" stroke="currentColor" opacity="0.4" />
          {yTicks.map((t,i)=>{
            const y = 200 - (t/maxY)*180;
            return (
              <g key={i}>
                <line x1="40" y1={y} x2={Math.max(600, days.length*22)} y2={y} stroke="currentColor" opacity="0.1" />
                <text x="6" y={y+4} fontSize="10">{t.toFixed(0)} €</text>
              </g>
            );
          })}
          {perDay.map((d, i)=>{
            const x = 50 + i*20;
            const h = (d.sum/maxY)*180;
            const y = 200 - h;
            return (
              <g key={d.date}>
                <rect x={x} y={y} width="14" height={h} className="fill-emerald-600"></rect>
                <text x={x+7} y="214" fontSize="9" textAnchor="middle">{parseInt(d.date.slice(-2),10)}</text>
                {d.sum>0 && <text x={x+7} y={y-6} fontSize="10" textAnchor="middle">{d.sum.toFixed(0)}€</text>}
              </g>
            );
          })}
          <text x="6" y="8" fontSize="10">€ per dieną</text>
          <text x={Math.max(600, days.length*22)-20} y="230" fontSize="10" textAnchor="end">Dienos</text>
        </svg>
      </div>
    </div>
  );
}
