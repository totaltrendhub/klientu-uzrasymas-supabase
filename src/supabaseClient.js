// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Veiks ir su Vite (import.meta.env), ir su CRA (process.env)
const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  process.env.REACT_APP_SUPABASE_URL;

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase env kintamieji nerasti. Patikrink Vercel/Local .env.');
}

// Pagrindinis klientas – su sesijos išsaugojimu (localStorage).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    detectSessionInUrl: true,
  },
});

// „Ephemeral“ (neprisiminimo) režimo vėliava
let EPHEMERAL_MODE = false;

// Supabase auth tokeno raktas localStorage'e (kad galėtume išvalyti)
let AUTH_STORAGE_KEY = '';
try {
  const host = new URL(supabaseUrl).hostname;          // pvz. abcdefgh.supabase.co
  const projectRef = host.split('.')[0];               // pvz. abcdefgh
  AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;    // oficialus raktas
} catch {
  // leave empty if URL parsing fails
}

// Kiekvieno auth įvykio metu – jei EPHEMERAL_MODE, išvalom saugyklą, kad naršyklėje
// neliktų prisijungimo. Taip „neprisiminimo“ režimas veiks iki puslapio uždarymo.
supabase.auth.onAuthStateChange((_event, _session) => {
  if (EPHEMERAL_MODE && AUTH_STORAGE_KEY) {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
  }
});

// Vieša funkcija: įjungti / išjungti „prisiminti mane“.
// - remember = true  -> normalus režimas (sesija saugoma localStorage).
// - remember = false -> „ephemeral“ (sesija NEsaugoma; po lango uždarymo reikia prisijungti iš naujo).
export function setRememberMe(remember) {
  EPHEMERAL_MODE = !remember;

  // Jei dabar perjungta į „neprisiminimą“, išvalom kas jau buvo išsaugota.
  if (EPHEMERAL_MODE && AUTH_STORAGE_KEY) {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
  }
}
