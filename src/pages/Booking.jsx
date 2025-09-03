// src/pages/Booking.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "../supabaseClient";
import TimeField from "../components/TimeField";
import DateField from "../components/DateField";
import Modal from "../components/Modal";

// ---- Pagalbininkai kainos autofill'ui ----
const norm = (v) => (v ?? "").toString().trim();
const isEmptyName = (name) => {
  const n = norm(name);
  return n === "" || n === "-" || n === "—" || n === "–";
};
const getDefaultPrice = (services, category, serviceId) => {
  // 1) jei pasirinkta subpaslauga – jos default_price
  if (serviceId) {
    const s = services.find((x) => String(x.id) === String(serviceId));
    if (s && s.default_price != null) return s.default_price;
  }
  // 2) jei tik kategorija – tos kategorijos eilutė be pavadinimo
  if (norm(category)) {
    const row = services.find(
      (x) => norm(x.category) === norm(category) && isEmptyName(x.name)
    );
    if (row && row.default_price != null) return row.default_price;
  }
  return "";
};

function toSec(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 3600 + m * 60;
}

export default function Booking({ workspace }) {
  // 3. Data/laikas/kaina/pastabos
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [start, setStart] = useState("09:15");
  const [end, setEnd] = useState("10:00");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [priceEdited, setPriceEdited] = useState(false);

  // 1. Klientas (autocomplete)
  const [clientSearch, setClientSearch] = useState("");
  const [clientQuery, setClientQuery] = useState(""); // debounced
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const suggestBoxRef = useRef(null);

  // „Naujas klientas“
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "female",
  });

  // 2. Paslauga (kategorija & neprivaloma subpaslauga)
  const [services, setServices] = useState([]);
  const categories = useMemo(
    () => Array.from(new Set(services.map((s) => s.category))),
    [services]
  );
  const [category, setCategory] = useState("");
  const subservices = useMemo(
    () => services.filter((s) => s.category === category && !!s.name),
    [services, category]
  );
  const [serviceId, setServiceId] = useState(null);
  const selectedService = useMemo(
    () =>
      serviceId
        ? services.find((s) => String(s.id) === String(serviceId)) || null
        : null,
    [services, serviceId]
  );

  // --- Duomenų užkrovimas ---
  useEffect(() => {
    async function loadServices() {
      if (!workspace?.id) return;
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }
      setServices(data || []);
      if (data && data.length && !category) {
        setCategory(data[0].category);
        setServiceId(null);
      }
    }
    loadServices();
  }, [workspace?.id]); // tik keičiantis workspace

  // --- Autocomplete: debounce įvestį ---
  useEffect(() => {
    const t = setTimeout(() => setClientQuery(clientSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // --- Autocomplete: fetch ---
  useEffect(() => {
    async function fetchSuggestions() {
      if (!workspace?.id) return;
      const q = clientQuery;
      if (q.length < 2) {
        setClientSuggestions([]);
        return;
      }
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,phone,email")
        .eq("workspace_id", workspace.id)
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(10);

      if (error) {
        console.error(error);
        setClientSuggestions([]);
        return;
      }
      setClientSuggestions(data || []);
    }
    fetchSuggestions();
  }, [clientQuery, workspace?.id]);

  // --- Uždaryti pasiūlymų dėžutę paspaudus už jos ribų ---
  useEffect(() => {
    function onDocClick(e) {
      if (!suggestBoxRef.current) return;
      if (!suggestBoxRef.current.contains(e.target)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  // --- Automat. kainos užpildymas ---
  useEffect(() => {
    setPriceEdited(false);
  }, [category, serviceId]);

  useEffect(() => {
    if (!workspace?.id) return;
    if (priceEdited) return;
    const p = getDefaultPrice(services, category, serviceId);
    if (p !== "" && p != null) setPrice(String(p));
  }, [workspace?.id, services, category, serviceId, priceEdited]);

  // --- Veiksmai ---
  async function handleCreateClient() {
    if (!newClient.name.trim()) {
      alert("Įveskite kliento vardą ir pavardę.");
      return;
    }
    const payload = {
      ...newClient,
      name: newClient.name.trim(),
      email: newClient.email.trim() || null,
      phone: newClient.phone.trim() || null,
      workspace_id: workspace.id,
    };

    const { data, error } = await supabase
      .from("clients")
      .insert(payload)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    // užpildom į lauką ir pasirinktam ID
    setClientSearch(data.name);
    setSelectedClientId(data.id);
    setClientSuggestions([]);
    setSuggestionsOpen(false);

    setShowNewClient(false);
    setNewClient({ name: "", phone: "", email: "", gender: "female" });
  }

  async function handleCreateAppointment() {
    if (!selectedClientId) return alert("Pasirinkite arba sukurkite klientą.");
    if (!category) return alert("Pasirinkite kategoriją.");
    const s = toSec(start),
      e = toSec(end);
    if (e <= s) return alert("Pabaiga turi būti vėliau nei pradžia.");

    // Persidengimų patikra (leidžiam back-to-back: [start, end))
    const { data: overlaps, error: ovErr } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("workspace_id", workspace.id)
      .eq("date", date)
      .lt("start_time", end + ":00")
      .gt("end_time", start + ":00");
    if (ovErr) return alert("Nepavyko patikrinti laikų: " + ovErr.message);
    if ((overlaps || []).length > 0)
      return alert("Laikas kertasi su kitu įrašu. Pasirinkite kitą intervalą.");

    const payload = {
      workspace_id: workspace.id,
      client_id: selectedClientId,
      service_id: serviceId || null, // gali būti NULL, jei tik kategorija
      category, // visada įrašom pasirinktą kategoriją
      date,
      start_time: start + ":00",
      end_time: end + ":00",
      price: price !== "" ? Number(price) : null,
      note: note || null,
      status: "scheduled",
    };

    const { error } = await supabase.from("appointments").insert(payload);
    if (error) return alert("Nepavyko sukurti rezervacijos: " + error.message);

    alert("Rezervacija sukurta.");
    // išvalom tik kintamus laukus
    setPrice("");
    setNote("");
    setPriceEdited(false);
  }

  // --- UI ---
  const saveDisabled = !selectedClientId || !category;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Klientas */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-3" ref={suggestBoxRef}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">1. Klientas</div>
          <button
            onClick={() => setShowNewClient(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Naujas klientas
          </button>
        </div>

        {/* Autocomplete įvestis */}
        <div className="relative">
          <input
            className="w-full px-3 py-2 rounded-xl border"
            placeholder="Įveskite bent 2 raides (vardas / pavardė)"
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              setSelectedClientId(null); // kol nepasirinkta — nėra ID
            }}
            onFocus={() => setSuggestionsOpen(true)}
            autoComplete="off"
            inputMode="text"
          />

          {/* Pasiūlymų dėžutė */}
          {suggestionsOpen && clientSearch.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto border rounded-2xl bg-white shadow divide-y">
              {clientSuggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onMouseDown={(e) => e.preventDefault()} // neleisti blur prieš onClick iOS
                  onClick={() => {
                    setClientSearch(c.name);
                    setSelectedClientId(c.id);
                    setSuggestionsOpen(false);
                  }}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-600">
                    {c.phone || "—"} {c.email ? "• " + c.email : ""}
                  </div>
                </button>
              ))}
              {clientSuggestions.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">Nieko nerasta.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Paslauga */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-3">
        <div className="text-lg font-semibold">2. Paslauga</div>

        {/* Kategorijų mygtukai */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {categories.length === 0 && (
            <div className="text-sm text-gray-500 col-span-full">
              Nėra kategorijų. Susikurkite skiltyje „Paslaugos“.
            </div>
          )}
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat);
                setServiceId(null); // į „tik kategorija“
                setPrice(""); // kad įsipildytų nauja numatyta kaina
                setPriceEdited(false);
              }}
              className={`px-3 py-2 rounded-xl border transition ${
                category === cat
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Subpaslaugos (nebūtinos) */}
        <div className="md:w-1/2">
          {category && subservices.length > 0 ? (
            <>
              <div className="text-sm text-gray-600 mb-1">
                Tikslesnė paslauga (nebūtina)
              </div>
              <select
                className="w-full px-3 py-2 rounded-xl border"
                value={serviceId || ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setServiceId(v);
                  setPrice("");
                  setPriceEdited(false);
                }}
              >
                <option value="">— Tik kategorija —</option>
                {subservices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </>
          ) : category ? (
            <div className="text-sm text-gray-600">
              Ši kategorija neturi subpaslaugų — bus naudojama tik kategorija.
            </div>
          ) : (
            <div className="text-sm text-gray-600">Pasirinkite kategoriją.</div>
          )}
        </div>
      </div>

      {/* 3. Data/laikas/kaina */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-3">
        <div className="text-lg font-semibold">3. Data, laikas ir kaina</div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Data</div>
            <DateField value={date} onChange={setDate} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Nuo</div>
            <TimeField value={start} onChange={setStart} step={1} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Iki</div>
            <TimeField value={end} onChange={setEnd} step={1} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Kaina (€)</div>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              className="w-full px-3 py-2 rounded-xl border"
              placeholder="pvz. 35"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceEdited(true);
              }}
            />
          </div>
        </div>

        <textarea
          className="w-full mt-1 px-3 py-2 rounded-xl border"
          rows={3}
          placeholder="Pastabos"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button
          onClick={handleCreateAppointment}
          disabled={saveDisabled}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white shadow hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Išsaugoti rezervaciją
        </button>
      </div>

      {/* Modalas: Naujas klientas */}
      <Modal
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        title="Naujas klientas"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowNewClient(false)}
              className="px-3 py-2 rounded-xl border"
            >
              Atšaukti
            </button>
            <button
              onClick={handleCreateClient}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
            >
              Išsaugoti
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            className="px-3 py-2 rounded-xl border"
            placeholder="Vardas ir pavardė"
            value={newClient.name}
            onChange={(e) =>
              setNewClient({ ...newClient, name: e.target.value })
            }
          />
          <input
            className="px-3 py-2 rounded-xl border"
            placeholder="Telefonas"
            value={newClient.phone}
            onChange={(e) =>
              setNewClient({ ...newClient, phone: e.target.value })
            }
          />
          <input
            className="px-3 py-2 rounded-xl border"
            placeholder="El. paštas"
            value={newClient.email}
            onChange={(e) =>
              setNewClient({ ...newClient, email: e.target.value })
            }
          />
          <select
            className="px-3 py-2 rounded-xl border"
            value={newClient.gender}
            onChange={(e) =>
              setNewClient({ ...newClient, gender: e.target.value })
            }
          >
            <option value="female">Moteris</option>
            <option value="male">Vyras</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
