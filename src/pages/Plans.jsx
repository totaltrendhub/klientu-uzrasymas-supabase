import React from "react";
import { useWorkspace } from "../workspace";

export default function Plans() {
  const { plan, setPlan } = useWorkspace();
  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-4">
      <div className="text-lg font-semibold">Planai (demo)</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { key: "free", title: "Free", desc: "Pagrindinės funkcijos" },
          { key: "mid",  title: "Mid",  desc: "Daugiau įrašų ir funkcijų" },
          { key: "pro",  title: "Pro",  desc: "Pilnas funkcionalumas" },
        ].map(p=>(
          <div key={p.key} className={`border rounded-2xl p-4 ${plan===p.key ? "ring-2 ring-emerald-500":""}`}>
            <div className="font-medium">{p.title}</div>
            <div className="text-sm text-gray-600 mb-3">{p.desc}</div>
            <button onClick={()=>{ setPlan(p.key); localStorage.setItem("plan", p.key); alert(`Plan set to: ${p.title}`); }}
              className="px-3 py-2 rounded-xl border">Pasirinkti</button>
          </div>
        ))}
      </div>
    </div>
  );
}
