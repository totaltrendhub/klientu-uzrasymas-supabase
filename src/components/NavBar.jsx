import React from "react";

const tabs = [
  { key: "day", label: "Kalendorius", icon: "🗓️" },
  { key: "clients", label: "Klientai", icon: "👤" },
  { key: "stats", label: "Statistika", icon: "📈" },
  { key: "services", label: "Paslaugos", icon: "🛠️" },
];

export default function NavBar({ tab, setTab }){
  return (
    <nav className="bg-gray-100 rounded-2xl p-1 overflow-x-auto whitespace-nowrap">
      <div className="flex gap-1 min-w-max">
        {tabs.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`px-3 py-2 rounded-xl text-sm flex items-center gap-1 ${tab===t.key? "bg-emerald-600 text-white":"bg-white border hover:bg-gray-50"}`}>
            <span aria-hidden>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
