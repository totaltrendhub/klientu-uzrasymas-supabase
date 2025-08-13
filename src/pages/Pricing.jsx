import React, { useState } from "react";
import { supabase } from "../supabaseClient";

const PLANS = [
  { key:"free", title:"Free", price:"0€", features:["1 paslauga","Iki 100 rezervacijų/mėn","1 vartotojas"] },
  { key:"mid", title:"Mid", price:"5€ / mėn", features:["10 paslaugų","Iki 1000 rez./mėn","2 vartotojai","Išplėsta statistika"] },
  { key:"pro", title:"Pro", price:"19€ / mėn", features:["Neribota","Komanda","Daugiau ataskaitų","Prioritetinis palaikymas"] },
];

export default function Pricing({ workspace, setWorkspace }){
  const [loading, setLoading] = useState(false);

  async function choose(plan){
    try{
      setLoading(true);
      const { error } = await supabase.from("workspaces").update({ plan }).eq("id", workspace.id);
      if(error) throw error;
      const { data } = await supabase.from("workspaces").select("*").eq("id", workspace.id).single();
      setWorkspace(data);
      alert("Planą pakeitėme į: " + plan.toUpperCase());
    }catch(e){
      alert(e.message);
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map(p => (
        <div key={p.key} className={`p-6 rounded-2xl border bg-white ${workspace.plan===p.key? "ring-2 ring-emerald-500":""}`}>
          <h3 className="text-xl font-semibold">{p.title}</h3>
          <div className="text-2xl font-bold mt-2">{p.price}</div>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {p.features.map(f => <li key={f}>• {f}</li>)}
          </ul>
          <button onClick={()=>choose(p.key)} disabled={loading} className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50">
            {workspace.plan===p.key ? "Aktyvus" : (loading? "Keičiama..." : "Pasirinkti")}
          </button>
        </div>
      ))}
    </div>
  );
}
