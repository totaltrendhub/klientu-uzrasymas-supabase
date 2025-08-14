// src/pages/Booking.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "../supabaseClient";
import TimeField from "../components/TimeField";
import DateField from "../components/DateField";
import Modal from "../components/Modal";

/* ---- Pagalbininkai ---- */
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
const validTimeRange = (start, end) => toSec(end) > toSec(start);

/* ---- Komponentas ---- */
export default function Booking({ workspace }) {
  /* Pranešimai */
  const [msg, setMsg] = useState(null); // {type:'ok'|'error', text:string}
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  /* 3. Data/laikas/kaina/pastabos */
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [start, setStart] = useState("09:15");
  const [end, setEnd] = useState("10:00");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [priceEdited, setPriceEdited] = useState(false);
  const [creatingAppt, setCreatingAppt] = useState(false);

  /* 1. Klientas */
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const clientSearchRef = useRef(null);

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "female",
  });
  const [creatingClient, setCreatingClient] = useState(false);
  const newClientFirstRef = useRef(null);

  /* 2. Paslauga */
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
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
    () => (serviceId ? services.find((s) => String(s.id) === String(serviceId)) || null : null),
    [services, serviceId]
  );

  /* Fokusas į paiešką atėjus į puslapį */
  useEffect(() => {
    clientSearchRef.current?.focus();
  }, []);

  /* --- Duomenų užkrovimas --- */
  useEffect(() => {
    async function loadServices() {
      if (!workspace?.id) return;
      setLoadingServices(true);
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      setLoadingServices(false);
      if (error) {
        setMsg({ type: "error", text: error.message });
        return;
      }
      setServices(data || []);
      if (data && data.length && !category) {
        setCategory(data[0].category);
        setServiceId(null);
      }
    }
    loadServices();
  }, [workspace.id]); // tik workspace pokyčiams

  // Debounce klientų paieškai
  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    async function loadClients() {
      if (!workspace?.id) return;
      setLoadingClients(true);
      let q = supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true })
        .limit(100);
      if (debouncedClientSearch) q = q.ilike("name", `%${debouncedClientSearch}%`);
      const { data, error } = await q;
      setLoadingClients(false);
      if (error) {
        setMsg({ type: "error", text: error.message });
        return;
      }
      setClients(data || []);
    }
    loadClients();
  }, [debouncedClientSearch, workspace.id]);

  /* --- Automat. kainos užpildymas --- */
  useEffect(() => {
    setPriceEdited(false);
  }, [category, serviceId]);

  useEffect(() => {
    if (!workspace?.id) return;
    if (priceEdited) return;
    const p = getDefaultPrice(services, category, serviceId);
    if (p !== "" && p != null) setPrice(String(p));
  }, [workspace?.id, services, category, serviceId, priceEdited]);

  /* --- Veiksmai --- */
  async function handleCreateClient() {
    if (creatingClient) return;
    if (!newClient.name.trim()) {
      setMsg({ type: "error", text: "Įveskite kliento vardą ir pavardę." });
      return;
    }
    const payload = {
      ...newClient,
      name: newClient.name.trim(),
      email: newClient.email.trim() || null,
      phone: newClient.phone.trim() || null,
      workspace_id: workspace.id,
    };

    try {
      setCreatingClient(true);
      const { data, error } = await supabase
        .from("clients")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      setClients((prev) =>
        [...prev, data]
          .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
          .sort((a, b) => a.name.localeCompare(b.name, "lt", { sensitivity: "base" }))
      );
      setClientSearch("");
      setSelectedClientId(data.id);
      setShowNewClient(false);
      setNewClient({ name: "", phone: "", email: "", gender: "female" });
      setMsg({ type: "ok", text: "Klientas sukurtas." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko sukurti kliento." });
    } finally {
      setCreatingClient(false);
    }
  }

  function validateAppointment() {
    if (!selectedClientId) return { ok: false, reason: "Pasirinkite arba sukurkite klientą." };
    if (!category) return { ok: false, reason: "Pasirinkite kategoriją." };
    if (!validTimeRange(start, end)) return { ok: false, reason: "Pabaiga turi būti vėliau nei pradžia." };
    if (price !== "" && Number(price) < 0) return { ok: false, reason: "Kaina negali būti neigiama." };
    return { ok: true };
  }

  async function handleCreateAppointment() {
    if (creatingAppt) return;
    const v = validateAppointment();
    if (!v.ok) {
      setMsg({ type: "error", text: v.reason });
      return;
    }

    // Persidengimų patikra (leidžiam back-to-back: [start, end))
    const { data: overlaps, error: ovErr } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("workspace_id", workspace.id)
      .eq("date", date)
      .lt("start_time", end + ":00")
      .gt("end_time", start + ":00");
    if (ovErr) {
      setMsg({ type: "error", text: "Nepavyko patikrinti laikų: " + ovErr.message });
      return;
    }
    if ((overlaps || []).length > 0) {
      setMsg({ type: "error", text: "Laikas kertasi su kitu įrašu. Pasirinkite kitą intervalą." });
      return;
    }

    const payload = {
      workspace_id: workspace.id,
      client_id: selectedClientId,
      service_id: serviceId || null,
      category,
      date,
      start_time: start + ":00",
      end_time: end + ":00",
      price: price !== "" ? Number(price) : null,
      note: note || null,
      status: "scheduled",
    };

    try {
      setCreatingAppt(true);
      const { error } = await supabase.from("appointments").insert(payload);
      if (error) throw error;

      setMsg({ type: "ok", text: "Rezervacija sukurta." });
      // Išvalom tik kintamus laukus
      setPrice("");
      setNote("");
      setPriceEdited(false);
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko sukurti rezervacijos." });
    } finally {
      setCreatingAppt(false);
    }
  }

  /* Klaviatūra modalui */
  useEffect(() => {
    if (showNewClient && newClientFirstRef.current) {
      newClientFirstRef.current.focus();
    }
  }, [showNewClient]);

  const onNewClientKeyDown = (e) => {
    if (e.key === "Escape") setShowNewClient(false);
    if (e.key === "Enter" && !creatingClient) {
      e.preventDefault();
      handleCreateClient();
    }
  };

  /* --- UI --- */
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Pranešimai */}
      {msg && (
        <div
          className={`px-3 py-2 rounded-xl text-sm ${
            msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
          role="status"
        >
          {msg.text}
        </div>
      )}

      {/* 1. Klientas */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">1. Klientas</div>
          <button
            onClick={() => setShowNewClient(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={creatingClient}
          >
            Naujas klientas
          </button>
        </div>

        <input
          ref={clientSearchRef}
          className="w-full px-3 py-2 rounded-xl border"
          placeholder="Paieška (vardas / pavardė)"
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          aria-label="Kliento paieška"
        />

        <div className="mt-2 max-h-64 overflow-auto border rounded-2xl divide-y">
          {loadingClients && (
            <div className="px-3 py-2 text-sm text-gray-500">Įkeliama...</div>
          )}
          {!loadingClients && clients.map((c) => {
            const selected = selectedClientId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedClientId(c.id)}
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
          {!loadingClients && clients.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">Nieko nerasta.</div>
          )}
        </div>
      </div>

      {/* 2. Paslauga */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-3">
        <div className="text-lg font-semibold">2. Paslauga</div>

        {/* Kategorijų mygtukai */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {loadingServices && (
            <div className="text-sm text-gray-500 col-span-full">Įkeliama...</div>
          )}
          {!loadingServices && categories.length === 0 && (
            <div className="text-sm text-gray-500 col-span-full">
              Nėra kategorijų. Susikurkite skiltyje „Paslaugos“.
            </div>
          )}
          {!loadingServices && categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
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
              aria-label={`Kategorija ${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Subpaslaugos (nebūtinos) */}
        <div className="md:w-1/2">
          {category && subservices.length > 0 ? (
            <>
              <div className="text-sm text-gray-600 mb-1">Tikslesnė paslauga (nebūtina)</div>
              <select
                className="w-full px-3 py-2 rounded-xl border"
                value={serviceId || ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setServiceId(v);
                  setPrice("");
                  setPriceEdited(false);
                }}
                aria-label="Subpaslauga"
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
              min="0"
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
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          disabled={creatingAppt}
          aria-label="Išsaugoti rezervaciją"
        >
          {creatingAppt ? "Saugoma..." : "Išsaugoti rezervaciją"}
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
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
              disabled={creatingClient}
            >
              {creatingClient ? "Saugoma..." : "Išsaugoti"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" onKeyDown={onNewClientKeyDown}>
          <input
            ref={newClientFirstRef}
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
