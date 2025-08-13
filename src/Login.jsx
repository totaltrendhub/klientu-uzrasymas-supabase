import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e){
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={signIn} className="bg-white p-6 rounded-2xl shadow w-full max-w-sm space-y-3">
        <h2 className="text-xl font-semibold">Prisijungimas</h2>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="El. paštas" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2" type="password" placeholder="Slaptažodis" value={password} onChange={e=>setPassword(e.target.value)} />
        <button disabled={loading} className="w-full bg-emerald-600 text-white rounded-xl px-3 py-2 hover:bg-emerald-700">
          {loading ? "Jungiamasi..." : "Prisijungti"}
        </button>
        <p className="text-xs text-gray-500">Paskyras kurkite Supabase &rarr; Authentication &rarr; Users.</p>
      </form>
    </div>
  );
}
