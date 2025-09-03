// src/Login.jsx
import React, { useEffect, useState } from "react";
import { supabase, setRememberMe } from "./supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  // 👇 Autologin: jei jau yra sesija, redirectinam į /
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.href = "/";
      }
    }
    checkSession();
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setLoading(true);

    // pritaikom pasirinkimą prieš login
    setRememberMe(remember);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    } else {
      window.location.href = "/"; // redirect į pagrindinį puslapį
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={signIn}
        className="bg-white p-6 rounded-2xl shadow w-full max-w-sm space-y-3"
      >
        <h2 className="text-xl font-semibold">Prisijungimas</h2>

        <input
          className="w-full border rounded-xl px-3 py-2"
          placeholder="El. paštas"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          className="w-full border rounded-xl px-3 py-2"
          type="password"
          placeholder="Slaptažodis"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <label className="flex items-center gap-2 text-sm select-none">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Prisiminti mane</span>
        </label>

        <button
          disabled={loading}
          className="w-full bg-emerald-600 text-white rounded-xl px-3 py-2 hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Jungiamasi..." : "Prisijungti"}
        </button>
      </form>
    </div>
  );
}
