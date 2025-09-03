// src/App.jsx
import React, { useEffect, useState } from "react";
import DayView from "./pages/DayView";
import Booking from "./pages/Booking";
import Clients from "./pages/Clients";
import Stats from "./pages/Stats";
import SettingsServices from "./pages/SettingsServices";
import Pricing from "./pages/Pricing";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import NavBar from "./components/NavBar";

export default function App() {
  const [initializing, setInitializing] = useState(true); // laukiam pradinės sesijos
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("day");
  const [workspace, setWorkspace] = useState(null);

  // 1) Pradinė sesija + auth state listener
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
      setInitializing(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      // kai prisijungiama/atsijungiama, workspace krausim/valysim atskirai
      if (!sess) setWorkspace(null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // 2) Užkraunam (arba sukuriam) asmeninį workspace, kai turim sesiją
  useEffect(() => {
    if (!session) return;

    let canceled = false;
    (async () => {
      try {
        // užtikrinam, kad asmeninis workspace egzistuoja
        await supabase.rpc("ensure_personal_workspace");

        // pasiimam pirmą workspace
        const { data, error } = await supabase
          .from("workspace_members")
          .select("workspace_id, workspaces(id, name, plan)")
          .eq("user_id", session.user.id)
          .limit(1)
          .maybeSingle();

        if (!canceled) {
          if (error) {
            console.error(error);
            setWorkspace(null);
          } else {
            setWorkspace(data?.workspaces || null);
          }
        }
      } catch (e) {
        console.error(e);
        if (!canceled) setWorkspace(null);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [session]);

  // Inic. būsena – rodom „Kraunama...“
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Kraunama...
      </div>
    );
  }

  // Nėra sesijos – rodom Login
  if (!session) return <Login />;

  // Yra sesija, bet dar nekrautas workspace
  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Kraunama...
      </div>
    );
  }

  // Pagrindinis app
  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4">
      <header className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow">
            KU
          </div>
          <div>
            <h1 className="text-2xl font-bold">Klientų užrašymas</h1>
            <p className="text-sm text-gray-500">
              Workspace: <b>{workspace.name}</b> • Planas: <b>{workspace.plan}</b>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              // sesiją nuims onAuthStateChange → parodys Login
            }}
            className="px-3 py-2 rounded-full border hover:bg-gray-50"
          >
            Atsijungti
          </button>
        </div>
      </header>

      <NavBar tab={tab} setTab={setTab} />

      {tab === "booking" && <Booking workspace={workspace} />}
      {tab === "day" && <DayView workspace={workspace} />}
      {tab === "clients" && <Clients workspace={workspace} />}
      {tab === "stats" && <Stats workspace={workspace} />}
      {tab === "services" && <SettingsServices workspace={workspace} />}
      {tab === "pricing" && <Pricing workspace={workspace} setWorkspace={setWorkspace} />}
    </div>
  );
}
