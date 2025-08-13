import React, { useEffect, useState } from "react";
import Booking from "./pages/Booking";
import DayView from "./pages/DayView";
import Clients from "./pages/Clients";
import Stats from "./pages/Stats";
import SettingsServices from "./pages/SettingsServices";
import Pricing from "./pages/Pricing";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import NavBar from "./components/NavBar";

export default function App(){
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("booking");
  const [workspace, setWorkspace] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(()=>{
    if(!session) return;
    (async ()=>{
      await supabase.rpc("ensure_personal_workspace");
      const { data } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(id, name, plan)")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      setWorkspace(data?.workspaces || null);
    })();
  },[session]);

  if(!session) return <Login />;
  if(!workspace) return <div className="min-h-screen flex items-center justify-center">Kraunama...</div>;

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4">
      <header className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow">KU</div>
          <div>
            <h1 className="text-2xl font-bold">Klientų užrašymas</h1>
            <p className="text-sm text-gray-500">Workspace: <b>{workspace.name}</b> • Planas: <b>{workspace.plan}</b></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>supabase.auth.signOut()} className="px-3 py-2 rounded-full border hover:bg-gray-50">Atsijungti</button>
        </div>
      </header>

      <NavBar tab={tab} setTab={setTab} />

      {tab==="booking" && <Booking workspace={workspace} />}
      {tab==="day" && <DayView workspace={workspace} />}
      {tab==="clients" && <Clients workspace={workspace} />}
      {tab==="stats" && <Stats workspace={workspace} />}
      {tab==="services" && <SettingsServices workspace={workspace} />}
      {tab==="pricing" && <Pricing workspace={workspace} setWorkspace={setWorkspace} />}
    </div>
  );
}
