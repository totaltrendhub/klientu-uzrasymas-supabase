import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "../supabaseClient";
import TimeField from "../components/TimeField";
import DateField from "../components/DateField";

function toTime(t){ return t?.slice(0,5) || ""; }

function StatusPill({ status }){
  const map = {
    attended: { text: "Atvyko", cls: "bg-emerald-100 text-emerald-800" },
    no_show: { text: "Neatvyko", cls: "bg-rose-100 text-rose-800" },
    scheduled: { text: "Suplanuota", cls: "bg-gray-100 text-gray-700" }
  };
  const s = map[status||"scheduled"];
  return <span className={`text-xs px-2 py-1 rounded-full ${s.cls}`}>{s.text}</span>;
}

export default function DayView(){
  const [date, setDate] = useState(()=>format(new Date(),"yyyy-MM-dd"));
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ date:"", start_time:"", end_time:"", price:"", note:"" });

  async function load(){
    const { data } = await supabase
      .from("appointments")
      .select("*, clients(name, phone), services(name, category)")
      .eq("date", date)
      .order("start_time", { ascending: true });
    setItems(data||[]);
  }

  useEffect(()=>{ load(); },[date]);

  function startEdit(a){
    setEditingId(a.id);
    setForm({
      date: a.date,
      start_time: toTime(a.start_time),
      end_time: toTime(a.end_time),
      price: a.price ?? "",
      note: a.note ?? ""
    });
  }

  async function saveEdit(id){
    const { data: overlaps } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("date", form.date)
      .neq("id", id)
      .lt("start_time", form.end_time + ":00")
      .gt("end_time", form.start_time + ":00");
    if((overlaps||[]).length>0) return alert("Laikas kertasi su kitu įrašu.");

    const { error } = await supabase.from("appointments").update({
      date: form.date,
      start_time: form.start_time + ":00",
      end_time: form.end_time + ":00",
      price: form.price === "" ? null : Number(form.price),
      note: form.note
    }).eq("id", id);
    if(error){ alert(error.message); return; }
    setEditingId(null);
    await load();
  }

  async function remove(id){
    if(!confirm("Pašalinti įrašą?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if(error){ alert(error.message); return; }
    await load();
  }

  async function setStatus(id, status){
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if(error){ alert(error.message); return; }
    // Optimistiškai atnaujinam vietoje, kad matytum iškart
    setItems(prev => prev.map(x => x.id===id ? { ...x, status } : x));
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="text-lg font-semibold">Dienos grafikas</div>
        <div className="w-56"><DateField value={date} onChange={setDate} /></div>
      </div>
      <div className="space-y-3">
        {items.length===0 && <div className="text-gray-500">Šiai dienai nėra įrašų.</div>}
        {items.map(a => (
          <div key={a.id} className="p-4 border rounded-2xl">
            {editingId===a.id ? (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                <div className="md:col-span-2">
                  <div className="text-xs text-gray-500">Data</div>
                  <DateField value={form.date} onChange={v=>setForm({...form, date:v})} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Nuo</div>
                  <TimeField value={form.start_time} onChange={(v)=>setForm({...form, start_time:v})} step={1} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Iki</div>
                  <TimeField value={form.end_time} onChange={(v)=>setForm({...form, end_time:v})} step={1} />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Kaina (€)</div>
                  <input type="number" step="0.01" className="w-full px-3 py-2 rounded-xl border" value={form.price} onChange={e=>setForm({...form, price:e.target.value})} />
                </div>
                <div className="md:col-span-6">
                  <div className="text-xs text-gray-500">Pastabos</div>
                  <input className="w-full px-3 py-2 rounded-xl border" value={form.note} onChange={e=>setForm({...form, note:e.target.value})} />
                </div>
                <div className="flex gap-2 md:col-span-6">
                  <button onClick={()=>saveEdit(a.id)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white">Išsaugoti</button>
                  <button onClick={()=>setEditingId(null)} className="px-3 py-2 rounded-xl border">Atšaukti</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="font-medium">{toTime(a.start_time)}–{toTime(a.end_time)} — {a.clients?.name} <StatusPill status={a.status} /></div>
                  <div className="text-sm text-gray-600">{a.services?.category}{a.services?.name ? " • "+a.services.name : ""} {a.price ? `• ${a.price} €` : ""}</div>
                  {a.note && <div className="text-sm text-gray-600">Pastabos: {a.note}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={()=>setStatus(a.id,"attended")} className="px-3 py-2 rounded-xl border hover:bg-gray-50">Atvyko</button>
                  <button onClick={()=>setStatus(a.id,"no_show")} className="px-3 py-2 rounded-xl border hover:bg-gray-50">Neatvyko</button>
                  <button onClick={()=>startEdit(a)} className="px-3 py-2 rounded-xl border hover:bg-gray-50">Redaguoti</button>
                  <button onClick={()=>remove(a.id)} className="px-3 py-2 rounded-xl border text-red-600 hover:bg-red-50">Šalinti</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
