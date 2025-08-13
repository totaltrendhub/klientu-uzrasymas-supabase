import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Clients(){
  const [search, setSearch] = useState("");
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);

  async function load(){
    let q = supabase.from("clients").select("*").order("name", { ascending: true }).limit(200);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    setList(data||[]);
  }
  useEffect(()=>{ load(); },[search]);

  async function openClient(c){
    setSelected(c);
    const { data } = await supabase
      .from("appointments")
      .select("*, services(name, category)")
      .eq("client_id", c.id)
      .order("date", { ascending:false })
      .order("start_time", { ascending:false });
    setHistory(data||[]);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="lg:col-span-1 bg-white rounded-2xl shadow p-4 sm:p-5">
        <div className="text-lg font-semibold mb-3">Klientai</div>
        <input className="w-full px-3 py-2 rounded-xl border mb-3" placeholder="Paieška pagal vardą" value={search} onChange={e=>setSearch(e.target.value)} />
        <div className="divide-y border rounded-2xl bg-white overflow-hidden">
          {list.map(c=>(
            <button key={c.id} onClick={()=>openClient(c)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selected?.id===c.id ? "bg-emerald-50 border-l-4 border-emerald-500" : ""}`}>
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-gray-600">{c.phone} {c.email? "• "+c.email:""} {c.gender? "• "+c.gender:""}</div>
            </button>
          ))}
          {list.length===0 && <div className="px-4 py-3 text-gray-500">Nieko nerasta.</div>}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4 sm:p-5 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold">Istorija</div>
          {selected && <div className="text-sm text-gray-600">Klientas: <b>{selected.name}</b></div>}
        </div>
        {!selected && <div className="text-gray-500">Pasirinkite klientą kairėje, kad pamatytumėte jo istoriją.</div>}
        {selected && (
          <div className="-mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="p-2">Data</th>
                  <th className="p-2">Laikas</th>
                  <th className="p-2">Paslauga</th>
                  <th className="p-2">Kaina</th>
                  <th className="p-2">Pastabos</th>
                </tr>
              </thead>
              <tbody>
                {history.map(a=>(
                  <tr key={a.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{a.date}</td>
                    <td className="p-2 whitespace-nowrap">{a.start_time?.slice(0,5)}–{a.end_time?.slice(0,5)}</td>
                    <td className="p-2">{a.services?.category}{a.services?.name? " • "+a.services.name:""}</td>
                    <td className="p-2 whitespace-nowrap">{a.price? `${a.price} €`:"—"}</td>
                    <td className="p-2">{a.note || "—"}</td>
                  </tr>
                ))}
                {history.length===0 && (
                  <tr><td className="p-2 text-gray-500" colSpan="5">Šis klientas dar neturi įrašų.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
