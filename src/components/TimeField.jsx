import React from "react";

export default function TimeField({ value, onChange, step=1 }){
  // value 'HH:MM'
  const [h, m] = value?.split(":").map(Number) ?? [0,0];
  const hours = Array.from({length:24}, (_,i)=>i);
  const minutes = Array.from({length: Math.ceil(60/step)}, (_,k)=>k*step);
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <select className="px-3 py-2 rounded-xl border" value={String(h).padStart(2,"0")} onChange={e=>onChange(`${e.target.value}:${String(m).padStart(2,"0")}`)}>
        {hours.map(x=> <option key={x} value={String(x).padStart(2,"0")}>{String(x).padStart(2,"0")}</option>)}
      </select>
      <span className="opacity-70">:</span>
      <select className="px-3 py-2 rounded-xl border" value={String(m).padStart(2,"0")} onChange={e=>onChange(`${String(h).padStart(2,"0")}:${e.target.value}`)}>
        {minutes.map(x=> <option key={x} value={String(x).padStart(2,"0")}>{String(x).padStart(2,"0")}</option>)}
      </select>
    </div>
  );
}
