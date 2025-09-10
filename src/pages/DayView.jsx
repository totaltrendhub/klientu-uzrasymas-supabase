// src/pages/DayView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  isSameMonth,
  parseISO,
  getISODay,
} from "date-fns";
import { supabase } from "../supabaseClient";
import DateField from "../components/DateField";
import TimeField from "../components/TimeField";
import Modal from "../components/Modal";

const FALLBACK_WORK_START = "09:00";
const FALLBACK_WORK_END = "19:00";
const DEFAULT_COLOR = "#e5e7eb";

const t5 = (s) => s?.slice(0, 5) || "";
const toMin = (t) => {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
};
const lt = (a, b) => toMin(a) < toMin(b);
const diffMin = (a, b) => toMin(b) - toMin(a);

// sort helper
const byStart = (a, b) =>
  a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0;

function StatusPill({ status }) {
  const map = {
    attended: { text: "Atvyko", cls: "bg-emerald-100 text-emerald-800" },
    no_show: { text: "Neatvyko", cls: "bg-rose-100 text-rose-800" },
    scheduled: { text: "Suplanuota", cls: "bg-gray-100 text-gray-700" },
  };
  const s = map[status || "scheduled"];
  return (
    <span className={`rounded-full ${s.cls} text-[10px] sm:text-xs px-1.5 py-[2px] sm:px-2 sm:py-1`}>
      {s.text}
    </span>
  );
}

// --- textarea auto-resize helper ---
function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export default function DayView({ workspace }) {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  // Pasirinkta diena ir rodomas mėnuo
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [viewMonth, setViewMonth] = useState(() => new Date());

  // Dienos įrašai
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Darbo laikas / Miestai (su dienomis)
  const [workStart, setWorkStart] = useState(FALLBACK_WORK_START);
  const [workEnd, setWorkEnd] = useState(FALLBACK_WORK_END);
  // city objektas: {name, color, days:number[]}
  const [cities, setCities] = useState([]);

  // redagavimas
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({
    date: "",
    start_time: "",
    end_time: "",
    price: "",
    note: "",
    category: "",
    serviceId: null,
  });
  const [editPriceEdited, setEditPriceEdited] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // atverta kortelė
  const [expandedId, setExpandedId] = useState(null);

  // paslaugos
  const [services, setServices] = useState([]);
  const categories = useMemo(
    () => Array.from(new Set(services.map((s) => s.category))),
    [services]
  );

  // „pridėti iš tarpo“ modalas
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    start: "",
    end: "",
    category: "",
    serviceId: null,
    price: "",
    note: "",
  });
  const [addPriceEdited, setAddPriceEdited] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const addClientSearchRef = useRef(null);

  // klientai
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(null);

  // „Naujas klientas“
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "female",
  });
  const [creatingClient, setCreatingClient] = useState(false);

  // 3 taškų meniu
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  useEffect(() => {
    const closeOnOutside = () => setMenuOpenId(null);
    const closeOnEsc = (e) => e.key === "Escape" && setMenuOpenId(null);
    window.addEventListener("click", closeOnOutside);
    window.addEventListener("keydown", closeOnEsc);
    return () => {
      window.removeEventListener("click", closeOnOutside);
      window.removeEventListener("keydown", closeOnEsc);
    };
  }, []);

  /* ---- Kalendorius ---- */
  const weekLabels = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"];
  const monthGridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  useEffect(() => {
    const d = parseISO(date);
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [date]);

  /* ---- Užkrovimai ---- */

  // 1) Workspaces meta: work hours + cities (su days)
  useEffect(() => {
    async function loadMeta() {
      if (!workspace?.id) return;
      const { data, error } = await supabase
        .from("workspaces")
        .select("work_start, work_end, cities")
        .eq("id", workspace.id)
        .single();
      if (error) return;
      setWorkStart((data?.work_start || "").slice(0, 5) || FALLBACK_WORK_START);
      setWorkEnd((data?.work_end || "").slice(0, 5) || FALLBACK_WORK_END);

      const arr = Array.isArray(data?.cities) ? data.cities : [];
      setCities(
        arr.map((c) => ({
          name: String(c?.name ?? ""),
          color: String(c?.color ?? DEFAULT_COLOR),
          days: Array.isArray(c?.days)
            ? c.days.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
            : [],
        }))
      );
    }
    loadMeta();
  }, [workspace?.id]);

  // 2) Day items
  async function loadItems() {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("*, clients(name, phone), services(name, category, color)")
      .eq("workspace_id", workspace.id)
      .eq("date", date)
      .order("start_time", { ascending: true });
    setLoadingItems(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
    setItems(data || []);
  }
  useEffect(() => {
    loadItems();
  }, [date, workspace.id]);

  // 3) Services for autofill
  useEffect(() => {
    async function fetchServices() {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) {
        setMsg({ type: "error", text: error.message });
        return;
      }
      setServices(data || []);
    }
    fetchServices();
  }, [workspace.id]);

  /* ---- Miesto info (tik kalendoriaus dėžutėms) ---- */
  const cityForIsoDay = (isoDay) =>
    cities.find((c) => Array.isArray(c.days) && c.days.includes(isoDay)) || null;

  const currentIsoDay = getISODay(parseISO(date)); // 1..7
  const currentCity = cityForIsoDay(currentIsoDay);
  const currentCityName = currentCity?.name || "";
  const currentCityColor = currentCity?.color || DEFAULT_COLOR;

  /* ---- Spalvos įrašams ----
     DABAR (kaip prašei): miestas įrašo spalvos nekeičia.
     Prioritetas: 1) Subpaslaugos spalva
                  2) Kategorijos (be name) spalva
                  3) Pilka
  */
  const colorForAppt = (a) => {
    if (a?.services?.color) return String(a.services.color);
    const cat = a?.services?.category || a?.category || "";
    const catRow = services.find(
      (s) => s.category === cat && (s.name == null || String(s.name).trim() === "")
    );
    return catRow?.color ? String(catRow.color) : DEFAULT_COLOR;
  };

  // Subpaslaugos "Pridėti" modale
  const subservices = useMemo(
    () => services.filter((s) => s.category === addForm.category && !!s.name),
    [services, addForm.category]
  );
  const selectedAddService = useMemo(
    () => services.find((s) => s.id === addForm.serviceId) || null,
    [services, addForm.serviceId]
  );

  // Subpaslaugos redagavimo formoje
  const editSubservices = useMemo(
    () => services.filter((s) => s.category === edit.category && !!s.name),
    [services, edit.category]
  );
  const selectedEditService = useMemo(
    () => services.find((s) => s.id === edit.serviceId) || null,
    [services, edit.serviceId]
  );

  function startEdit(a) {
    setEditingId(a.id);
    setMenuOpenId(null);
    setExpandedId(a.id);
    setEdit({
      date: a.date,
      start_time: t5(a.start_time),
      end_time: t5(a.end_time),
      price: a.price ?? "",
      note: a.note ?? "",
      category: a?.services?.category || a?.category || "",
      serviceId: a?.service_id || null,
    });
    setEditPriceEdited(false);
  }

  useEffect(() => {
    setEditPriceEdited(false);
  }, [edit.category, edit.serviceId]);

  useEffect(() => {
    if (editPriceEdited) return;
    if (selectedEditService && selectedEditService.default_price != null) {
      setEdit((f) => ({ ...f, price: String(selectedEditService.default_price) }));
      return;
    }
    if (!edit.serviceId && edit.category) {
      const catRow =
        services.find(
          (s) =>
            s.category === edit.category &&
            (s.name == null || String(s.name).trim() === "")
        ) || null;
      if (catRow && catRow.default_price != null) {
        setEdit((f) => ({ ...f, price: String(catRow.default_price) }));
      }
    }
  }, [edit.category, edit.serviceId, selectedEditService, services, editPriceEdited]);

  function validTimeRange(start, end) {
    if (!start || !end) return false;
    return toMin(start) < toMin(end);
  }

  async function saveEdit(id) {
    if (savingEdit) return;
    if (!validTimeRange(edit.start_time, edit.end_time)) {
      setMsg({ type: "error", text: "Neteisingas laiko intervalas (Nuo < Iki)." });
      return;
    }
    if (edit.price !== "" && Number(edit.price) < 0) {
      setMsg({ type: "error", text: "Kaina negali būti neigiama." });
      return;
    }

    const { data: overlaps } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("workspace_id", workspace.id)
      .eq("date", edit.date)
      .neq("id", id)
      .lt("start_time", edit.end_time + ":00")
      .gt("end_time", edit.start_time + ":00");
    if ((overlaps || []).length > 0) {
      setMsg({ type: "error", text: "Laikas kertasi su kitu įrašu." });
      return;
    }

    const payload = {
      date: edit.date,
      start_time: edit.start_time + ":00",
      end_time: edit.end_time + ":00",
      price: edit.price === "" ? null : Number(edit.price),
      note: edit.note,
      category: edit.category || null,
      service_id: edit.serviceId || null,
    };

    try {
      setSavingEdit(true);
      const { data, error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", id)
        .select("*, clients(name, phone), services(name, category, color)")
        .single();
      if (error) throw error;

      setItems((prev) => {
        const next = prev.map((x) => (x.id === id ? data : x)).sort(byStart);
        return next;
      });
      setEditingId(null);
      setMsg({ type: "ok", text: "Rezervacija atnaujinta." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko išsaugoti." });
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Pašalinti įrašą?")) return;
    setDeletingId(id);
    const prev = items;
    setItems((cur) => cur.filter((x) => x.id !== id));
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      setMsg({ type: "ok", text: "Įrašas pašalintas." });
    } catch (e) {
      setItems(prev);
      setMsg({ type: "error", text: e.message || "Nepavyko pašalinti." });
    } finally {
      setDeletingId(null);
    }
  }

  async function setStatus(id, status) {
    setStatusUpdatingId(id);
    const prev = items;
    setItems((cur) => cur.map((x) => (x.id === id ? { ...x, status } : x)));
    setMenuOpenId(null);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setMsg({ type: "ok", text: "Statusas atnaujintas." });
    } catch (e) {
      setItems(prev);
      setMsg({ type: "error", text: e.message || "Nepavyko atnaujinti statuso." });
    } finally {
      setStatusUpdatingId(null);
    }
  }

  /* ---- Laisvi tarpai ---- */
  const slots = useMemo(() => {
    const startLimit = workStart || FALLBACK_WORK_START;
    const endLimit = workEnd || FALLBACK_WORK_END;

    const srt = [...items].sort(byStart);
    const res = [];
    let cur = startLimit;

    if (srt.length === 0) {
      if (lt(cur, endLimit)) res.push({ type: "gap", from: cur, to: endLimit });
      return res;
    }
    const firstStart = t5(srt[0].start_time);
    if (lt(cur, firstStart)) res.push({ type: "gap", from: cur, to: firstStart });

    srt.forEach((a, i) => {
      res.push({ type: "appt", data: a });
      const end = t5(a.end_time);
      cur = end;
      const next = srt[i + 1];
      if (next) {
        const nextStart = t5(next.start_time);
        if (lt(cur, nextStart)) res.push({ type: "gap", from: cur, to: nextStart });
      }
    });

    if (lt(cur, endLimit)) res.push({ type: "gap", from: cur, to: endLimit });
    return res;
  }, [items, workStart, workEnd]);

  /* ---- Pridėti rezervaciją iš tarpo ---- */
  function openAdd(from, to) {
    setAddForm({
      start: from,
      end: to,
      category: categories[0] || "",
      serviceId: null,
      price: "",
      note: "",
    });
    setAddPriceEdited(false);
    setClientSearch("");
    setSelectedClientId(null);
    setAddOpen(true);
    setTimeout(() => addClientSearchRef.current?.focus(), 0);
  }

  // auto-kaina (Pridėti)
  useEffect(() => setAddPriceEdited(false), [addForm.category, addForm.serviceId]);
  useEffect(() => {
    if (addPriceEdited) return;
    if (selectedAddService && selectedAddService.default_price != null) {
      setAddForm((f) => ({ ...f, price: String(selectedAddService.default_price) }));
      return;
    }
    if (!addForm.serviceId && addForm.category) {
      const catRow =
        services.find(
          (s) =>
            s.category === addForm.category &&
            (s.name == null || String(s.name).trim() === "")
        ) || null;
      if (catRow && catRow.default_price != null) {
        setAddForm((f) => ({ ...f, price: String(catRow.default_price) }));
      }
    }
  }, [addForm.category, addForm.serviceId, selectedAddService, services, addPriceEdited]);

  function validTimeRange(start, end) {
    if (!start || !end) return false;
    return toMin(start) < toMin(end);
  }

  function validAdd() {
    if (!selectedClientId)
      return { ok: false, reason: "Pasirinkite klientą arba sukurkite naują." };
    if (!addForm.category)
      return { ok: false, reason: "Pasirinkite kategoriją." };
    if (!validTimeRange(addForm.start, addForm.end))
      return { ok: false, reason: "Neteisingas laiko intervalas (Nuo < Iki)." };
    if (addForm.price !== "" && Number(addForm.price) < 0)
      return { ok: false, reason: "Kaina negali būti neigiama." };
    return { ok: true };
  }

  async function saveAdd() {
    if (savingAdd) return;
    const v = validAdd();
    if (!v.ok) {
      setMsg({ type: "error", text: v.reason });
      return;
    }

    const { data: overlaps } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("workspace_id", workspace.id)
      .eq("date", date)
      .lt("start_time", addForm.end + ":00")
      .gt("end_time", addForm.start + ":00");
    if ((overlaps || []).length > 0) {
      setMsg({ type: "error", text: "Laikas kertasi su kitu įrašu." });
      return;
    }

    const payload = {
      workspace_id: workspace.id,
      client_id: selectedClientId,
      category: addForm.category,
      service_id: addForm.serviceId || null,
      date,
      start_time: addForm.start + ":00",
      end_time: addForm.end + ":00",
      price: addForm.price !== "" ? Number(addForm.price) : null,
      note: addForm.note || null,
      status: "scheduled",
    };

    try {
      setSavingAdd(true);
      const { data, error } = await supabase
        .from("appointments")
        .insert(payload)
        .select("*, clients(name, phone), services(name, category, color)")
        .single();
      if (error) throw error;

      setItems((prev) => [...prev, data].sort(byStart));
      setMsg({ type: "ok", text: "Rezervacija sukurta." });
      setAddOpen(false);
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko sukurti." });
    } finally {
      setSavingAdd(false);
    }
  }

  // Debounce paieškai + fetch klientų (rodome nuo 2 simbolių)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    async function fetchClients() {
      if (!workspace?.id) return;
      const q = debouncedClientSearch;
      if (q.length < 2) {
        setClients([]);
        return;
      }
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", workspace.id)
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(100);
      if (error) {
        setMsg({ type: "error", text: error.message });
        return;
      }
      setClients(data || []);
    }
    fetchClients();
  }, [debouncedClientSearch, workspace?.id]);

  /* ---- Kliento kūrimas modale ---- */
  async function createClient() {
    if (creatingClient) return;
    if (!newClient.name.trim()) {
      setMsg({ type: "error", text: "Įveskite kliento vardą ir pavardę." });
      return;
    }
    const payload = {
      name: newClient.name.trim(),
      phone: newClient.phone.trim() || null,
      email: newClient.email.trim() || null,
      gender: newClient.gender,
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
        [...prev, data].sort((a, b) =>
          a.name.localeCompare(b.name, "lt", { sensitivity: "base" })
        )
      );
      setSelectedClientId(data.id);
      setNewClientOpen(false);
      setNewClient({ name: "", phone: "", email: "", gender: "female" });
      setMsg({ type: "ok", text: "Klientas sukurtas." });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko sukurti kliento." });
    } finally {
      setCreatingClient(false);
    }
  }

  const monthLabel = viewMonth.toLocaleDateString("lt-LT", {
    month: "long",
    year: "numeric",
  });

  // navigacijos helperiai, kad nebūtų dubliavimo tarp mobil/desktop
  const goToday = () => {
    const t = new Date();
    const ds = format(t, "yyyy-MM-dd");
    setDate(ds);
    setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1));
  };
  const prevMonth = () => setViewMonth((d) => addMonths(d, -1));
  const nextMonth = () => setViewMonth((d) => addMonths(d, 1));

  // modal klaviatūra: Enter leidžiam tik Ctrl/⌘+Enter; textarea – visada leidžiam Enter
  const onAddKeyDown = (e) => {
    if (e.target && e.target.tagName === "TEXTAREA") return;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !savingAdd) {
      e.preventDefault();
      saveAdd();
    }
    if (e.key === "Escape") setAddOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow p-3 sm:p-5 space-y-2 sm:space-y-4">
      {/* Pranešimai */}
      {msg && (
        <div
          className={`px-3 py-2 rounded-xl text-sm ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
          role="status"
        >
          {msg.text}
        </div>
      )}

      {/* Kalendorius */}
      <div className="overflow-x-hidden">
        {/* Mobile (kompaktiška) */}
        <div className="sm:hidden mb-2">
          <div className="text-base font-semibold mb-1">Kalendorius</div>
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-1 w-full">
            <button
              className="h-8 w-8 rounded-xl border hover:bg-gray-50 flex items-center justify-center"
              onClick={prevMonth}
              aria-label="Ankstesnis mėnuo"
            >
              ◀
            </button>
            <div className="text-center font-medium capitalize text-sm truncate">
              {monthLabel}
            </div>
            <button
              className="h-8 w-8 rounded-xl border hover:bg-gray-50 flex items-center justify-center"
              onClick={nextMonth}
              aria-label="Kitas mėnuo"
            >
              ▶
            </button>
          </div>
          <div className="mt-2">
            <button
              className="text-xs px-2 py-1.5 rounded-xl border hover:bg-gray-50"
              onClick={goToday}
              aria-label="Šiandien"
            >
              Šiandien
            </button>
          </div>
        </div>

        {/* Desktop / ≥sm */}
        <div className="hidden sm:flex items-center mb-2 gap-2">
          <div className="text-lg font-semibold mr-3">Kalendorius</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              onClick={prevMonth}
              aria-label="Ankstesnis mėnuo"
            >
              ◀
            </button>
            <button
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              onClick={goToday}
              aria-label="Šiandien"
            >
              Šiandien
            </button>
            <div className="text-center font-medium capitalize text-base">
              {monthLabel}
            </div>
            <button
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              onClick={nextMonth}
              aria-label="Kitas mėnuo"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Miestų legenda */}
        {cities.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {cities.map((c) => (
              <div
                key={c.name}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
                title={c.name}
              >
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{ backgroundColor: c.color || DEFAULT_COLOR }}
                />
                <span className="truncate max-w-[140px]">{c.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Savaitės dienos */}
        <div className="grid grid-cols-7 text-center text-[11px] sm:text-xs mb-1">
          {weekLabels.map((w, i) => (
            <div
              key={w}
              className={"py-0.5 " + (i >= 5 ? "text-rose-600" : "text-gray-500")}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Dienų tinklelis — nuspalvinama pagal cities[].days */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {monthGridDays.map((d) => {
            const isOtherMonth = !isSameMonth(d, viewMonth);
            const dStr = format(d, "yyyy-MM-dd");
            const isSelected = dStr === date;
            const isToday = d.toDateString() === new Date().toDateString();
            const isWeekend = d.getDay() === 6 || d.getDay() === 0;

            const isoDay = getISODay(d); // 1..7
            const city = cityForIsoDay(isoDay);
            const assignedCity = city?.name || "";
            const assignedColor = city?.color || null;

            const baseCls =
              "relative h-9 sm:h-12 rounded-xl border text-[13px] sm:text-sm flex items-center justify-center transition-colors " +
              (isSelected
                ? "bg-emerald-600 text-white border-emerald-600"
                : isWeekend
                ? "hover:bg-rose-100"
                : "hover:bg-gray-50") +
              (isOtherMonth ? " opacity-40" : "") +
              (isToday && !isSelected ? " border-2 border-emerald-500 ring-1 ring-emerald-200" : "") +
              (!isSelected && assignedCity ? " text-white" : "");

            return (
              <button
                key={dStr}
                onClick={() => setDate(dStr)}
                className={baseCls}
                title={assignedCity ? `${dStr} • ${assignedCity}` : dStr}
                style={
                  !isSelected && assignedColor
                    ? { backgroundColor: assignedColor, borderColor: assignedColor }
                    : undefined
                }
              >
                {d.getDate()}
                {isToday && !isSelected && (
                  <span
                    className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500"
                    aria-label="Šiandien"
                  />
                )}
                {!isSelected && assignedCity && !isOtherMonth && (
                  <div className="absolute left-1 bottom-0.5 text-[10px] sm:text-[11px] font-medium pointer-events-none">
                    {assignedCity}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pasirinktos dienos antraštė (miestas – informacinis) */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="text-sm sm:text-base font-medium">
          {new Date(date).toLocaleDateString("lt-LT", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
        {currentCityName && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs sm:text-sm">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: currentCityColor }} />
            {currentCityName}
          </div>
        )}
      </div>

      {/* Dienos įrašai */}
      <div className="space-y-2 sm:space-y-3">
        {loadingItems && (
          <div className="p-2 sm:p-4 border rounded-2xl text-gray-500">Įkeliama...</div>
        )}

        {!loadingItems &&
          slots.map((slot, i) =>
            slot.type === "gap" ? (
              <div
                key={`gap-${i}`}
                className="p-2 sm:p-4 border-2 border-dashed rounded-2xl bg-amber-50/60 text-amber-800 flex items-center justify-between"
              >
                <div className="font-medium text-[13px] sm:text-base leading-tight">
                  Laisvas tarpas {slot.from}–{slot.to}{" "}
                  <span className="text-amber-700">• {diffMin(slot.from, slot.to)} min</span>
                </div>
                <button
                  onClick={() => openAdd(slot.from, slot.to)}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border hover:bg-amber-100 text-[13px] sm:text-sm"
                  aria-label="Pridėti rezervaciją"
                >
                  Pridėti
                </button>
              </div>
            ) : (
              <div
                key={slot.data.id}
                className={`relative p-2 sm:p-4 border rounded-2xl cursor-pointer ${
                  expandedId === slot.data.id ? "bg-gray-50" : ""
                } ${deletingId === slot.data.id ? "opacity-50" : ""}`}
                onClick={() =>
                  setExpandedId((prev) => (prev === slot.data.id ? null : slot.data.id))
                }
              >
                {/* SPALVOS JUOSTA (tik paslaugos/kategorijos) */}
                <div
                  className="absolute left-0 top-0 bottom-0 rounded-l-2xl"
                  style={{ width: "6px", backgroundColor: colorForAppt(slot.data) }}
                  aria-hidden="true"
                />

                {editingId === slot.data.id ? (
                  <div className="space-y-3">
                    {/* Kategorija + subpaslauga */}
                    <div>
                      <div className="text-[11px] text-gray-500 mb-1">Kategorija</div>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => {
                              setEdit((f) => ({
                                ...f,
                                category: cat,
                                serviceId: null,
                                price: "",
                              }));
                              setEditPriceEdited(false);
                            }}
                            className={
                              "inline-flex items-center px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border whitespace-nowrap text-sm " +
                              (edit.category === cat
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white hover:bg-gray-50")
                            }
                            aria-label={`Kategorija ${cat}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {edit.category && (
                        <div className="mt-2 md:w-1/2">
                          {editSubservices.length > 0 ? (
                            <>
                              <div className="text-[11px] text-gray-500 mb-1">
                                Tikslesnė paslauga (nebūtina)
                              </div>
                              <select
                                className="w-full px-3 py-2 rounded-xl border text-sm"
                                value={edit.serviceId || ""}
                                onChange={(e) => {
                                  const v = e.target.value || null;
                                  setEdit((f) => ({ ...f, serviceId: v, price: "" }));
                                  setEditPriceEdited(false);
                                }}
                                aria-label="Subpaslauga"
                              >
                                <option value="">— Tik kategorija —</option>
                                {editSubservices.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </>
                          ) : (
                            <div className="text-[12px] text-gray-600">
                              Ši kategorija neturi subpaslaugų — bus naudojama tik
                              kategorija.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Data/Laikas/Kaina/Pastabos */}
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                      <div className="md:col-span-2">
                        <div className="text-[11px] text-gray-500">Data</div>
                        <DateField
                          value={edit.date}
                          onChange={(v) => setEdit({ ...edit, date: v })}
                        />
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">Nuo</div>
                        <TimeField
                          value={edit.start_time}
                          onChange={(v) => setEdit({ ...edit, start_time: v })}
                          step={1}
                        />
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">Iki</div>
                        <TimeField
                          value={edit.end_time}
                          onChange={(v) => setEdit({ ...edit, end_time: v })}
                          step={1}
                        />
                      </div>
                      <div>
                        <div className="text-[11px] text-gray-500">Kaina (€)</div>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-2.5 py-2 rounded-xl border text-sm"
                          value={edit.price}
                          onChange={(e) => {
                            setEdit({ ...edit, price: e.target.value });
                            setEditPriceEdited(true);
                          }}
                          min="0"
                        />
                      </div>
                      <div className="md:col-span-6">
                        <div className="text-[11px] text-gray-500">Pastabos</div>
                        <textarea
                          rows={2}
                          className="w-full px-2.5 py-2 rounded-xl border text-sm"
                          value={edit.note}
                          onChange={(e) => {
                            setEdit({ ...edit, note: e.target.value });
                            autoGrow(e.target);
                          }}
                          ref={(el) => el && autoGrow(el)}
                        />
                      </div>
                      <div className="flex gap-2 md:col-span-6">
                        <button
                          onClick={() => saveEdit(slot.data.id)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm disabled:opacity-50"
                          disabled={savingEdit}
                        >
                          {savingEdit ? "Saugoma..." : "Išsaugoti"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="px-3 py-2 rounded-xl border text-sm"
                        >
                          Atšaukti
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-1 sm:gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-[13px] sm:text-base leading-tight truncate">
                          {t5(slot.data.start_time)} — {slot.data.clients?.name}
                        </div>
                        <div className="text-[12px] text-gray-600 truncate flex items-center gap-1.5">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: colorForAppt(slot.data) }}
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            {slot.data.services?.category || slot.data.category}
                            {slot.data.services?.name
                              ? " • " + slot.data.services.name
                              : ""}{" "}
                            {slot.data.price ? `• ${slot.data.price} €` : ""}
                          </span>
                        </div>

                        {expandedId === slot.data.id && (
                          <div className="mt-1 text-[12px] text-gray-700 space-y-1">
                            <div>
                              {t5(slot.data.start_time)}–{t5(slot.data.end_time)}
                            </div>
                            {currentCityName && (
                              <div className="inline-flex items-center gap-1">
                                <span
                                  className="inline-block w-2 h-2 rounded"
                                  style={{ backgroundColor: currentCityColor }}
                                />
                                <span>{currentCityName}</span>
                              </div>
                            )}
                            {slot.data.note && (
                              <div className="whitespace-pre-wrap">
                                {slot.data.note}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <StatusPill status={slot.data.status} />
                        <button
                          className="p-1.5 sm:p-2 rounded-lg border hover:bg-gray-50 text-lg leading-none disabled:opacity-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(
                              menuOpenId === slot.data.id ? null : slot.data.id
                            );
                          }}
                          aria-label="Daugiau veiksmų"
                          disabled={
                            statusUpdatingId === slot.data.id ||
                            deletingId === slot.data.id
                          }
                        >
                          ⋯
                        </button>
                      </div>
                    </div>

                    {menuOpenId === slot.data.id && (
                      <div
                        className="absolute right-2 top-9 sm:top-10 z-10 w-40 sm:w-44 rounded-xl border bg-white shadow-lg p-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                          onClick={() => setStatus(slot.data.id, "scheduled")}
                        >
                          Suplanuota
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                          onClick={() => setStatus(slot.data.id, "attended")}
                        >
                          Atvyko
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                          onClick={() => setStatus(slot.data.id, "no_show")}
                        >
                          Neatvyko
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                          onClick={() => startEdit(slot.data)}
                        >
                          Redaguoti
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-sm text-rose-600"
                          onClick={() => remove(slot.data.id)}
                        >
                          Šalinti
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          )}
        {!loadingItems && slots.length === 0 && (
          <div className="p-2 sm:p-4 border rounded-2xl text-gray-500">
            Šiai dienai įrašų nėra.
          </div>
        )}
      </div>

      {/* Modalas: pridėti rezervaciją */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Pridėti rezervaciją"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setAddOpen(false)}>
              Atšaukti
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
              onClick={saveAdd}
              disabled={savingAdd}
            >
              {savingAdd ? "Saugoma..." : "Išsaugoti"}
            </button>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1 ios-scroll" onKeyDown={onAddKeyDown}>
          <div className="md:hidden sticky top-0 z-10 flex justify-end -mt-2 -mr-2">
            <button
              onClick={() => setAddOpen(false)}
              className="m-2 px-2 py-1 rounded-lg border bg-white"
              aria-label="Uždaryti"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* Klientas */}
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 mb-1">Klientas</div>
                <button
                  className="text-sm px-2 py-1 rounded-lg border"
                  onClick={() => setNewClientOpen(true)}
                >
                  Naujas klientas
                </button>
              </div>
              <input
                ref={addClientSearchRef}
                className="w-full px-3 py-2 rounded-xl border"
                placeholder="Įveskite bent 2 raides..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  // jei keičiam paiešką – atšaukiam ankstesnį pasirinkimą
                  setSelectedClientId(null);
                }}
                aria-label="Kliento paieška"
              />
              <div className="max-h-48 overflow-auto mt-2 border rounded-2xl divide-y">
                {clients.map((c) => {
                  const sel = selectedClientId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setClientSearch(c.name);      // įrašom vardą
                        setClients([]);               // paslepiam pasiūlymus
                        addClientSearchRef.current?.blur(); // uždarom klaviatūrą
                      }}
                      className={`w-full text-left px-3 py-2 ${
                        sel ? "bg-emerald-50 border-l-4 border-emerald-500" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className={`font-medium ${sel ? "text-emerald-700" : ""}`}>{c.name}</div>
                      <div className="text-xs text-gray-600">
                        {c.phone || "—"} {c.email ? "• " + c.email : ""}
                      </div>
                    </button>
                  );
                })}
                {clients.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Įveskite bent 2 raides, kad pamatytumėte klientų sąrašą.
                  </div>
                )}
              </div>
            </div>

            {/* Paslauga */}
            <div>
              <div className="text-sm text-gray-600 mb-1">Kategorija</div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      setAddForm((f) => ({ ...f, category: cat, serviceId: null }))
                    }
                    className={
                      "inline-flex items-center px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border whitespace-nowrap text-sm " +
                      (addForm.category === cat
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white hover:bg-gray-50")
                    }
                    aria-label={`Kategorija ${cat}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {addForm.category && (
                <div className="mt-2 md:w-1/2">
                  {subservices.length > 0 ? (
                    <>
                      <div className="text-sm text-gray-600 mb-1">
                        Tikslesnė paslauga (nebūtina)
                      </div>
                      <select
                        className="w-full px-3 py-2 rounded-xl border"
                        value={addForm.serviceId || ""}
                        onChange={(e) =>
                          setAddForm((f) => ({ ...f, serviceId: e.target.value || null }))
                        }
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
                  ) : (
                    <div className="text-sm text-gray-600">
                      Ši kategorija neturi subpaslaugų — bus naudojama tik kategorija.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Laikas / Kaina / Pastabos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Nuo</div>
                <TimeField
                  value={addForm.start}
                  onChange={(v) => setAddForm((f) => ({ ...f, start: v }))}
                  step={1}
                />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Iki</div>
                <TimeField
                  value={addForm.end}
                  onChange={(v) => setAddForm((f) => ({ ...f, end: v }))}
                  step={1}
                />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Kaina (€)</div>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-xl border"
                  value={addForm.price}
                  onChange={(e) => {
                    setAddForm((f) => ({ ...f, price: e.target.value }));
                    setAddPriceEdited(true);
                  }}
                  placeholder="pvz. 35"
                  min="0"
                />
              </div>
              <div className="md:col-span-4">
                <div className="text-sm text-gray-600 mb-1">Pastabos</div>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border"
                  value={addForm.note}
                  onChange={(e) => {
                    setAddForm((f) => ({ ...f, note: e.target.value }));
                    autoGrow(e.target);
                  }}
                  ref={(el) => el && autoGrow(el)}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Submodalas: Naujas klientas */}
      <Modal
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        title="Naujas klientas"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setNewClientOpen(false)}>
              Atšaukti
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
              onClick={createClient}
              disabled={creatingClient}
            >
              {creatingClient ? "Saugoma..." : "Išsaugoti"}
            </button>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1 ios-scroll">
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
        </div>
      </Modal>
    </div>
  );
}
