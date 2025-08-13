// src/supabase.js
import { createClient } from "@supabase/supabase-js";

// CRA / React-scripts aplinkoje:
const url = process.env.REACT_APP_SUPABASE_URL;
const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;

// (jei naudotum Vite, būtų import.meta.env.VITE_... – bet pas jus CRA, taip kad REACT_APP_ teisinga)

export const supabase = createClient(url, anon);
