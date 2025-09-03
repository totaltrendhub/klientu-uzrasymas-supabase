// src/pages/Booking.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  if (serviceId) {
    const s = services.find((x) => String(x.id) === String(serviceId));
    if (s && s.default_price != null) return s.default_price;
  }
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
function secToHHMM(sec) {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}
function addMinHHMM(hhmm, minutes) {
  return secToHHMM(toSec(hhmm) + minutes * 60);
}

/* Paprastas „toast“ komponentas */
function SuccessToast({ open, text, onClose }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center z-[9999]"
      style={{ transition: "opacity .2s, transform .2s" }}
    >
      <div
        className={
          "pointer-events-auto rounded-xl shadow-lg border bg-white px-4 py-3 flex items-center gap-2 " +
          (open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
        }
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-sm">✔</span>
        <span className="text-sm text-gray-800">{text}</span>
        <button
          onClick={onClose}
          className="ml-2 px-2 py-1 text-sm rounded-lg hover:bg-gray-100"
        >
          Uždaryti
        </button>
      </div>
    </div>
  );
}

export default function Booking({ workspace }) {
  const [toastOpen, setToastOpen] = useState(false);
  const [toastText, setToastText] = useState("");

  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [start, setStart] = useState("09:15");
  const [end, setEnd] = useState("10:00");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [priceEdited, setPriceEdited] = useState(false);

  // 1. Klientas
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "female",
  });

  // 2. Paslauga
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
  }, [workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadClients() {
      if (!workspace?.id) return;
      let q = supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true })
        .limit(100);
      if (clientSearch && clientSearch.trim().length >= 2) {
        q = q.ilike("name", `%${clientSearch.trim()}%`);
      }
      const { data, error } = await q;
      if (error) {
        console.error(error);
        return;
      }
      setClients(data || []);
    }
    loadClients();
  }, [clientSearch, workspace.id]);

  // --- Auto kaina ---
  useEffect(() => {
    setPriceEdited(false);
  }, [category, serviceId]);
  useEffect(() => {
    if (!workspace?.id || priceEdited) return;
    // default price
    if (selectedService && selectedService.default_price != null) {
      setPrice(String(selectedService.default_price));
      return;
    }
    const row = services.find(
      (x) => norm(x.category) === norm(category) && isEmptyName(x.name)
    );
    if (row && row.default_price != null) setPrice(String(row.default_price));
  }, [workspace?.id, services, category, serviceId, priceEdited, selectedService]);

  // --- Veiksmai ---
  async function handleCreateClient() {
    if (!newClient.name.trim()) return alert("Įveskite kliento vardą ir pavardę.");
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
    if (error) return alert(error.message);

    setClients((prev) =>
      [...prev, data]
        .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
        .sort((a, b) => a.name.localeCompare(b.name, "lt", { sensitivity: "base" }))
    );
    setClientSearch("");
    setSelectedClientId(data.id);
    setShowNewClient(false);
    setNewClient({ name: "", phone: "", email: "", gender: "female" });
  }

  async function handleCreateAppointment() {
    if (!selectedClientId) return alert("Pasirinkite arba sukurkite klientą.");
    if (!category) return alert("Pasirinkite kategoriją.");
    const s = toSec(start),
      e = toSec(end);
    if (e <= s) return alert("Pabaiga turi būti vėliau nei pradžia.");

    const { data: overlaps, error: ovErr } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("workspace_id", workspace.id)
      .eq("date", date)
      .lt("start_time", end + ":00")
      .gt("end_time", start + ":00");
    if (ovErr) return alert("Nepavyko patikrinti laikų: " + ovErr.message);
    if ((overlaps || []).length > 0) return alert("Laikas kertasi su kitu įrašu.");

    const payload = {
      workspace_id: workspace.id,
      client_id: selectedClientId,
      service_id: serviceId || null, // gali būti NULL, jei tik kategorija
      category,
      date,
      start_time: start + ":00",
      end_time: end + ":00",
      price: price !== "" ? Number(price) : null,
      note: note || null,
      status: "scheduled",
    };
    const { error } = await supabase.from("appointments").insert(payload);
    if (error) return alert("Nepavyko sukurti rezervacijos: " + error.message);

    // Sėkmė — TOAST
    setToastText("Rezervacija sukurta.");
    setToastOpen(true);

    // Patogiai perkeliam „Nuo“ į ką tik sukurtos pabaigą, „Iki“ – +30 min
    const nextStart = end;
    const nextEnd = addMinHHMM(end, 30);

    setSelectedClientId(null);
    setClientSearch("");
    setServiceId(null);
    setPrice("");
    setNote("");
    setPriceEdited(false);
    setStart(nextStart);
    setEnd(nextEnd);
  }

  // --- UI ---
  const saveDisabled = !selectedClientId || !category;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast (sėkmės pranešimas) */}
      <SuccessToast
        open={toastOpen}
        text={toastText}
        onClose={() => setToastOpen(false)}
      />

      {/* 1. Klientas */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">1. Klientas</div>
          <button
            onClick={() => setShowNewClient(true)}
            onTouchStart={() => setShowNewClient(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Naujas klientas
          </button>
        </div>

        <input
          className="w-full px-3 py-2 rounded-xl border"
          placeholder="Paieška (vardas / pavardė)"
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
        />

        {/* Mobile: natyvus select */}
        <div className="sm:hidden">
          <select
            className="mt-2 w-full px-3 py-2 rounded-xl border"
            value={selectedClientId || ""}
            onChange={(e) =>
              setSelectedClientId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">— Pasirink klientą —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop/Tablet: slenkamas sąrašas */}
        <div className="hidden sm:block">
          <div className="mt-2 max-h-64 overflow-auto border rounded-2xl divide-y ios-scroll">
            {clients.map((c) => {
              const selected = selectedClientId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClientId(c.id)}
                  onTouchStart={() => setSelectedClientId(c.id)}
                  className={`w-full text-left px-3 py-2 transition ${
                    selected
                      ? "bg-emerald-50 border-l-4 border-emerald-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className={`font-medium ${selected ? "text-emerald-700" : ""}`}>
                    {c.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {c.phone || "—"} {c.email ? "• " + c.email : ""}
                  </div>
                </button>
              );
            })}
            {clients.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Nieko nerasta.</div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Paslauga */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-3">
        <div className="text-lg font-semibold">2. Paslauga</div>

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
                setServiceId(null);
                setPrice("");
                setPriceEdited(false);
              }}
              onTouchStart={() => {
                setCategory(cat);
                setServiceId(null);
                setPrice("");
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
              Ši kategorija neturi subkategorijų — bus naudojama tik kategorija.
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
              min="0"
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
            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
          />
          <input
            className="px-3 py-2 rounded-xl border"
            placeholder="Telefonas"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
          />
          <input
            className="px-3 py-2 rounded-xl border"
            placeholder="El. paštas"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
          />
          <select
            className="px-3 py-2 rounded-xl border"
            value={newClient.gender}
            onChange={(e) => setNewClient({ ...newClient, gender: e.target.value })}
          >
            <option value="female">Moteris</option>
            <option value="male">Vyras</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
