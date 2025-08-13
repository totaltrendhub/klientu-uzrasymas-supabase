import React, { useEffect, useState } from "react";
import Booking from "./pages/Booking";
import DayView from "./pages/DayView";
import Clients from "./pages/Clients";
import Stats from "./pages/Stats";
import { supabase } from "./supabaseClient";
import Login from "./Login";

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm transition shadow-sm ${active ? "bg-emerald-600 text-white" : "bg-white hover:bg-gray-100 border"}`}>
      {children}
    </button>
  );
}

export default function App(){
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("booking");
  const [services, setServices] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(()=>{
    if(!session) return;
    async function load(){
      const { data, error } = await supabase.from("services").select("*").order("category").order("name");
      if(error){ console.error(error); }
      setServices(data||[]);
    }
    load();
  },[session]);

  if(!session) return <Login />;

  const email = session?.user?.email || "";

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <header className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow">KU</div>
          <div>
            <h1 className="text-2xl font-bold">Klientų užrašymas</h1>
            <p className="text-sm text-gray-500">Supabase versija</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex gap-2 bg-gray-100 p-1 rounded-full self-start sm:self-auto">
            <Tab active={tab==="booking"} onClick={()=>setTab("booking")}>Rezervacija</Tab>
            <Tab active={tab==="day"} onClick={()=>setTab("day")}>Dienos grafikas</Tab>
            <Tab active={tab==="clients"} onClick={()=>setTab("clients")}>Klientai</Tab>
            <Tab active={tab==="stats"} onClick={()=>setTab("stats")}>Statistika</Tab>
          </nav>
          <div className="hidden sm:block text-sm text-gray-600 px-2">{email}</div>
          <button onClick={()=>supabase.auth.signOut()} className="px-3 py-2 rounded-full border hover:bg-gray-50">Atsijungti</button>
        </div>
      </header>

      {tab==="booking" && <Booking services={services} />}
      {tab==="day" && <DayView services={services} />}
      {tab==="clients" && <Clients />}
      {tab==="stats" && <Stats services={services} />}
    </div>
  );
}
