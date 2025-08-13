import React, { useEffect, useRef, useState } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import lt from "date-fns/locale/lt";

export default function DateField({ value, onChange }){
  const [open, setOpen] = useState(false);
  const parsed = value ? parseISO(value) : new Date();
  const [viewDate, setViewDate] = useState(parsed);
  const ref = useRef(null);

  useEffect(()=>{
    function onClick(e){ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  },[]);

  const weekStartsOn = 1; // pirmadienis
  const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn, locale: lt });
  const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn, locale: lt });
  const days = [];
  for(let d=start; d<=end; d=addDays(d,1)){ days.push(d); }

  function pick(d){
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  }

  const dayNames = ["Pr","An","Tr","Kt","Pn","Št","Sk"];
  return (
    <div className="relative" ref={ref}>
      <input
        className="w-full px-3 py-2 rounded-xl border"
        value={value || ""}
        onChange={e=>onChange(e.target.value)}
        placeholder="YYYY-MM-DD"
        onFocus={()=>setOpen(true)}
      />
      {open && (
        <div className="absolute z-20 mt-2 bg-white border rounded-2xl shadow p-3 w-72">
          <div className="flex items-center justify-between mb-2">
            <button onClick={()=>setViewDate(addMonths(viewDate, -1))} className="px-2 py-1 rounded hover:bg-gray-100">‹</button>
            <div className="font-medium">{format(viewDate, "LLLL yyyy", { locale: lt })}</div>
            <button onClick={()=>setViewDate(addMonths(viewDate, 1))} className="px-2 py-1 rounded hover:bg-gray-100">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
            {dayNames.map(d=><div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d,i)=>{
              const isCurMonth = isSameMonth(d, viewDate);
              const isSelected = value && isSameDay(d, parsed);
              return (
                <button key={i} onClick={()=>pick(d)} className={`py-2 rounded-lg text-sm ${isCurMonth? "":"text-gray-400"} ${isSelected? "bg-emerald-600 text-white": "hover:bg-gray-100"}`}>
                  {format(d, "d", { locale: lt })}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
