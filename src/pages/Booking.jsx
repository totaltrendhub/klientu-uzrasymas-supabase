import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "../supabaseClient";
import TimeField from "../components/TimeField";
import DateField from "../components/DateField";

const CATEGORIES = ["Dažymas","Kirpimas","Procedūros","Konsultacija"];

function Card({ title, children, right }){
  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function Booking({ services }){
  const [date, setDate] = useState(()=>format(new Date(),"yyyy-MM-dd"));
  const [start, setStart] = useState("09:15");
  const [end, setEnd] = useState("10:00");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [newClient, setNewClient] = useState({ name:"", phone:"", email:"", gender:"female" });

  const [category, setCategory] = useState("Dažymas");
  const subservices = useMemo(()=>services.filter(s=>s.category===category),[services,category]);
  const [serviceId, setServiceId] = useState(null);

  useEffect(()=>{ if(subservices.length>0) setServiceId(subservices[0].id); else setServiceId(null); },[category, subservices.length]);

  useEffect(()=>{
    async function load(){
      let q = supabase.from("clients").select("*");
      if (clientSearch) q = q.ilike("name", `%${clientSearch}%`);
      q = q.order("name", { ascending: true }).limit(50);
      const { data } = await q;
      setClients(data||[]);
    }
    load();
  },[clientSearch]);

  async function handleCreateClient(){
    if(!newClient.name) return alert("Įveskite kliento vardą.");
    const { data, error } = await supabase.from("clients").insert(newClient).select().single();
    if(error) return alert(error.message);
    setSelectedClientId(data.id);
    alert("Klientas sukurtas.");
  }

  function toSec(t){ const [h,m]=t.split(":").map(Number); return h*3600+m*60; }

  async function handleCreateAppointment(){
    if(!selectedClientId) return alert("Pasirinkite arba sukurkite klientą.");
    if((category==="Dažymas"||category==="Kirpimas") && !serviceId) return alert("Pasirinkite tikslesnę paslaugą.");
    const s=toSec(start), e=toSec(end);
    if(e<=s) return alert("Pabaigos laikas turi būti vėliau nei pradžia.");

    // Overlap check (back-to-back allowed)
    const { data: overlaps, error: ovErr } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("date", date)
      .lt("start_time", end + ":00")
      .gt("end_time", start + ":00");
    if(ovErr) return alert("Nepavyko patikrinti laikų: " + ovErr.message);
    if((overlaps||[]).length>0) return alert("Laikas kertasi su kitu įrašu. Pasirinkite kitą intervalą.");

    const payload = {
      client_id: selectedClientId,
      service_id: serviceId,
      category,
      date,
      start_time: start + ":00",
      end_time: end + ":00",
      price: price ? Number(price) : null,
      note,
      status: "scheduled"
    };
    const { error } = await supabase.from("appointments").insert(payload);
    if(error) return alert("Nepavyko sukurti rezervacijos: " + error.message);
    alert("Rezervacija sukurta.");
    setNote(""); setPrice("");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card title="1. Klientas" right={null}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Ieškoti esamo kliento</div>
            <input className="w-full px-3 py-2 rounded-xl border" value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="Vardas / pavardė" />
            <div className="mt-2 max-h-64 overflow-auto border rounded-2xl bg-white divide-y">
              {(clients||[]).map(c=>{
                const selected = selectedClientId===c.id;
                return (
                  <button key={c.id} onClick={()=>setSelectedClientId(c.id)}
                    className={`w-full text-left px-3 py-2 transition ${selected ? "bg-emerald-50 border-l-4 border-emerald-500" : "hover:bg-gray-50"}`}>
                    <div className={`font-medium ${selected? "text-emerald-700":""}`}>{c.name}</div>
                    <div className="text-xs text-gray-600">{c.phone} {c.email? "• "+c.email:""}</div>
                  </button>
                );
              })}
              {clients?.length===0 && <div className="px-3 py-2 text-sm text-gray-500">Nieko nerasta</div>}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-600 mb-1">Naujas klientas</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className="px-3 py-2 rounded-xl border" placeholder="Vardas ir pavardė" value={newClient.name} onChange={e=>setNewClient({...newClient, name:e.target.value})} />
              <input className="px-3 py-2 rounded-xl border" placeholder="Telefonas" value={newClient.phone} onChange={e=>setNewClient({...newClient, phone:e.target.value})} />
              <input className="px-3 py-2 rounded-xl border" placeholder="El. paštas" value={newClient.email} onChange={e=>setNewClient({...newClient, email:e.target.value})} />
              <select className="px-3 py-2 rounded-xl border" value={newClient.gender} onChange={e=>setNewClient({...newClient, gender:e.target.value})}>
                <option value="female">Moteris</option>
                <option value="male">Vyras</option>
              </select>
              <div className="text-xs text-gray-500">Lytis</div>
            </div>
            <button onClick={handleCreateClient} className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white shadow hover:bg-emerald-700">Sukurti klientą</button>
          </div>
        </div>
      </Card>

      <Card title="2. Paslauga">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Kategorija</div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={()=>setCategory(cat)}
                  className={`px-3 py-2 rounded-xl border transition ${category===cat ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:bg-gray-50"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            {(category==="Dažymas"||category==="Kirpimas") ? (
              <div>
                <div className="text-sm text-gray-600 mb-1">Tikslesnė paslauga</div>
                <select className="w-full px-3 py-2 rounded-xl border" value={serviceId||""} onChange={e=>setServiceId(e.target.value)}>
                  {subservices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="text-gray-600 text-sm">„{category}“ neturi papildomų pasirenkamų variantų.</div>
            )}
          </div>
        </div>
      </Card>

      <Card title="3. Data, laikas ir kaina">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><div className="text-sm text-gray-600 mb-1">Data</div><DateField value={date} onChange={setDate} /></div>
          <div><div className="text-sm text-gray-600 mb-1">Nuo</div><TimeField value={start} onChange={setStart} step={1} /></div>
          <div><div className="text-sm text-gray-600 mb-1">Iki</div><TimeField value={end} onChange={setEnd} step={1} /></div>
          <div><div className="text-sm text-gray-600 mb-1">Kaina (€)</div><input type="number" step="0.01" className="w-full px-3 py-2 rounded-xl border" value={price} onChange={e=>setPrice(e.target.value)} placeholder="pvz. 35" /></div>
        </div>
        <textarea className="w-full mt-3 px-3 py-2 rounded-xl border" rows={3} placeholder="Pastabos" value={note} onChange={e=>setNote(e.target.value)} />
        <button onClick={handleCreateAppointment} className="px-4 py-2 rounded-xl bg-emerald-600 text-white shadow hover:bg-emerald-700">Išsaugoti rezervaciją</button>
      </Card>
    </div>
  );
}
