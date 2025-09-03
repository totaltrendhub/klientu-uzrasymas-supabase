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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
