// src/pages/DayView.jsx
import React, { useEffect, useMemo, useState } from "react";
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
} from "date-fns";
import { supabase } from "../supabaseClient";
import DateField from "../components/DateField";
import TimeField from "../components/TimeField";
import Modal from "../components/Modal";

const WORK_START = "09:00";
const WORK_END = "19:00";

const t5 = (s) => s?.slice(0, 5) || "";
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const lt = (a, b) => toMin(a) < toMin(b);
const diffMin = (a, b) => toMin(b) - toMin(a);

function StatusPill({ status }) {
  const map = {
    attended: { text: "Atvyko", cls: "bg-emerald-100 text-emerald-800" },
    no_show: { text: "Neatvyko", cls: "bg-rose-100 text-rose-800" },
    scheduled: { text: "Suplanuota", cls: "bg-gray-100 text-gray-700" },
  };
  const s = map[status || "scheduled"];
  return <span className={`text-xs px-2 py-1 rounded-full ${s.cls}`}>{s.text}</span>;
}

export default function DayView({ workspace }) {
  // Pasirinkta diena (rodysime jos įrašus)
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  // Mėnuo rodomas kalendoriuje
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [items, setItems] = useState([]);

  // redagavimas
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ date: "", start_time: "", end_time: "", price: "", note: "" });

  // paslaugos/kategorijos (reikalinga greitam pridėjimui iš tarpo)
  const [services, setServices] = useState([]);
  const categories = useMemo(() => Array.from(new Set(services.map((s) => s.category))), [services]);

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

  // klientai greitam pridėjimui
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(null);

  // „Naujas klientas“ mini forma modale
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "female",
  });

  // --------- KALENDORIUS (mėnesio tinklelis) ----------
  const weekLabels = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"];
  const monthGridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  // Jei pasikeičia pasirinkta data – sinchronizuojam rodomą mėnesį
  useEffect(() => {
    const d = parseISO(date);
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [date]);

  // --------- Užkrovimai ----------
  async function load() {
    const { data, error } = await supabase
      .from("appointments")
      .select("*, clients(name, phone), services(name, category)")
      .eq("workspace_id", workspace.id)
      .eq("date", date)
      .order("start_time", { ascending: true });
    if (!error) setItems(data || []);
  }
  useEffect(() => { load(); }, [date, workspace.id]);

  useEffect(() => {
    async function fetchServices() {
      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      setServices(data || []);
    }
    fetchServices();
  }, [workspace.id]);

  useEffect(() => {
    async function fetchClients() {
      let q = supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true })
        .limit(100);
    if (clientSearch) q = q.ilike("name", `%${clientSearch}%`);
      const { data } = await q;
      setClients(data || []);
    }
    fetchClients();
  }, [clientSearch, workspace.id, addOpen]);

  const subservices = useMemo(
    () => services.filter((s) => s.category === addForm.category && !!s.name),
    [services, addForm.category]
  );
  const selectedAddService = useMemo(
    () => services.find((s) => s.id === addForm.serviceId) || null,
    [services, addForm.serviceId]
  );

  function startEdit(a) {
    setEditingId(a.id);
    setEdit({
      date: a.date,
      start_time: t5(a.start_time),
      end_time: t5(a.end_time),
      price: a.price ?? "",
      note: a.note ?? "",
    });
  }

  async function saveEdit(id) {
    const { data: overlaps } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("workspace_id", workspace.id)
      .eq("date", edit.date)
      .neq("id", id)
      .lt("start_time", edit.end_time + ":00")
      .gt("end_time", edit.start_time + ":00");
    if ((overlaps || []).length > 0) return alert("Laikas kertasi su kitu įrašu.");

    const { error } = await supabase
      .from("appointments")
      .update({
        date: edit.date,
        start_time: edit.start_time + ":00",
        end_time: edit.end_time + ":00",
        price: edit.price === "" ? null : Number(edit.price),
        note: edit.note,
      })
      .eq("id", id);
    if (error) return alert(error.message);

    setEditingId(null);
    await load();
  }

  async function remove(id) {
    if (!window.confirm("Pašalinti įrašą?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) return alert(error.message);
    await load();
  }

  async function setStatus(id, status) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) return alert(error.message);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  /** --------- Laisvi tarpai dienoje ---------- */
  const slots = useMemo(() => {
    const srt = [...items].sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
    const res = [];
    let cur = WORK_START;

    if (srt.length === 0) {
      if (lt(cur, WORK_END)) res.push({ type: "gap", from: cur, to: WORK_END });
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

    if (lt(cur, WORK_END)) res.push({ type: "gap", from: cur, to: WORK_END });
    return res;
  }, [items]);

  /** --------- Pridėti rezervaciją iš tarpo ---------- */
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
  }

  // auto-kaina greitam pridėjimui
  useEffect(() => { setAddPriceEdited(false); }, [addForm.category, addForm.serviceId]);
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

  async function saveAdd() {
    if (!selectedClientId) return alert("Pasirinkite klientą arba sukurkite naują.");
    if (!addForm.category) return alert("Pasirinkite kategoriją.");
    const { data: overlaps } = await supabase
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("workspace_id", workspace.id)
      .eq("date", date)
      .lt("start_time", addForm.end + ":00")
      .gt("end_time", addForm.start + ":00");
    if ((overlaps || []).length > 0) return alert("Laikas kertasi su kitu įrašu.");

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
    const { error } = await supabase.from("appointments").insert(payload);
    if (error) return alert(error.message);

    setAddOpen(false);
    await load();
  }

  async function createClient() {
    if (!newClient.name.trim()) return alert("Įveskite kliento vardą ir pavardę.");
    const payload = {
      name: newClient.name.trim(),
      phone: newClient.phone.trim() || null,
      email: newClient.email.trim() || null,
      gender: newClient.gender,
      workspace_id: workspace.id,
    };
    const { data, error } = await supabase.from("clients").insert(payload).select().single();
    if (error) return alert(error.message);
    setClients((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name, "lt", { sensitivity: "base" }))
    );
    setSelectedClientId(data.id);
    setNewClientOpen(false);
    setNewClient({ name: "", phone: "", email: "", gender: "female" });
  }

  // --------- UI ----------
  const monthLabel = viewMonth.toLocaleDateString("lt-LT", { month: "long", year: "numeric" });

  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-4">
      {/* Kalendorius (mėnesio tinklelis) */}
      <div>
        {/* Pavadinimas + mėnesio perjungimas KAIRĖJE */}
        <div className="flex items-center mb-2">
          <div className="text-lg font-semibold mr-3">Kalendorius</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              onClick={() => setViewMonth((d) => addMonths(d, -1))}
              aria-label="Ankstesnis mėnuo"
            >
              ◀
            </button>
            <div className="min-w-[180px] text-center font-medium capitalize">
              {monthLabel}
            </div>
            <button
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              onClick={() => setViewMonth((d) => addMonths(d, 1))}
              aria-label="Kitas mėnuo"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Savaitės dienos */}
        <div className="grid grid-cols-7 text-center text-xs mb-1">
          {weekLabels.map((w, i) => (
            <div
              key={w}
              className={"py-1 " + (i >= 5 ? "text-rose-600" : "text-gray-500")}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Dienų tinklelis */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {monthGridDays.map((d) => {
            const isOtherMonth = !isSameMonth(d, viewMonth);
            const dStr = format(d, "yyyy-MM-dd");
            const isSelected = dStr === date;
            const isToday = d.toDateString() === new Date().toDateString();
            const isWeekend = d.getDay() === 6 || d.getDay() === 0; // Št / Sk

            const cls =
              "h-10 sm:h-12 rounded-xl border text-sm flex items-center justify-center " +
              (isSelected
                ? "bg-emerald-600 text-white border-emerald-600"
                : isWeekend
                ? "bg-rose-50 hover:bg-rose-100"
                : "bg-white hover:bg-gray-50") +
              (isOtherMonth ? " opacity-40" : "") +
              (isToday && !isSelected ? " ring-1 ring-emerald-300" : "");

            return (
              <button key={dStr} onClick={() => setDate(dStr)} className={cls} title={dStr}>
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pasirinktos dienos antraštė (be seno DateField) */}
      <div className="text-base font-medium">
        {new Date(date).toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" })}
      </div>

      {/* Dienos įrašų sąrašas su tarpais */}
      <div className="space-y-3">
        {slots.map((slot, i) =>
          slot.type === "gap" ? (
            <div
              key={`gap-${i}`}
              className="p-4 border-2 border-dashed rounded-2xl bg-amber-50/60 text-amber-800 flex items-center justify-between"
            >
              <div className="font-medium">
                Laisvas tarpas {slot.from}–{slot.to}{" "}
                <span className="text-amber-700">• {diffMin(slot.from, slot.to)} min</span>
              </div>
              <button
                onClick={() => openAdd(slot.from, slot.to)}
                className="px-3 py-2 rounded-xl border hover:bg-amber-100"
              >
                Pridėti rezervaciją
              </button>
            </div>
          ) : (
            <div key={slot.data.id} className="p-4 border rounded-2xl">
              {editingId === slot.data.id ? (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                  <div className="md:col-span-2">
                    <div className="text-xs text-gray-500">Data</div>
                    <DateField value={edit.date} onChange={(v) => setEdit({ ...edit, date: v })} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Nuo</div>
                    <TimeField value={edit.start_time} onChange={(v) => setEdit({ ...edit, start_time: v })} step={1} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Iki</div>
                    <TimeField value={edit.end_time} onChange={(v) => setEdit({ ...edit, end_time: v })} step={1} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Kaina (€)</div>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full px-3 py-2 rounded-xl border"
                      value={edit.price}
                      onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-6">
                    <div className="text-xs text-gray-500">Pastabos</div>
                    <input
                      className="w-full px-3 py-2 rounded-xl border"
                      value={edit.note}
                      onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 md:col-span-6">
                    <button onClick={() => saveEdit(slot.data.id)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white">
                      Išsaugoti
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-xl border">
                      Atšaukti
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      {t5(slot.data.start_time)}–{t5(slot.data.end_time)} — {slot.data.clients?.name}{" "}
                      <StatusPill status={slot.data.status} />
                    </div>
                    <div className="text-sm text-gray-600">
                      {slot.data.services?.category || slot.data.category}
                      {slot.data.services?.name ? " • " + slot.data.services.name : ""}{" "}
                      {slot.data.price ? `• ${slot.data.price} €` : ""}
                    </div>
                    {slot.data.note && (
                      <div className="text-sm text-gray-600">Pastabos: {slot.data.note}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setStatus(slot.data.id, "attended")} className="px-3 py-2 rounded-xl border hover:bg-gray-50">
                      Atvyko
                    </button>
                    <button onClick={() => setStatus(slot.data.id, "no_show")} className="px-3 py-2 rounded-xl border hover:bg-gray-50">
                      Neatvyko
                    </button>
                    <button onClick={() => startEdit(slot.data)} className="px-3 py-2 rounded-xl border hover:bg-gray-50">
                      Redaguoti
                    </button>
                    <button onClick={() => remove(slot.data.id)} className="px-3 py-2 rounded-xl border text-red-600 hover:bg-red-50">
                      Šalinti
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Modalas: pridėti rezervaciją iš laisvo tarpo */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Pridėti rezervaciją"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setAddOpen(false)}>Atšaukti</button>
            <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white" onClick={saveAdd}>Išsaugoti</button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Klientas */}
          <div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 mb-1">Klientas</div>
              <button className="text-sm px-2 py-1 rounded-lg border" onClick={() => setNewClientOpen(true)}>
                Naujas klientas
              </button>
            </div>
            <input
              className="w-full px-3 py-2 rounded-xl border"
              placeholder="Paieška pagal vardą"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            <div className="max-h-48 overflow-auto mt-2 border rounded-2xl divide-y">
              {clients.map((c) => {
                const sel = selectedClientId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClientId(c.id)}
                    className={`w-full text-left px-3 py-2 ${sel ? "bg-emerald-50 border-l-4 border-emerald-500" : "hover:bg-gray-50"}`}
                  >
                    <div className={`font-medium ${sel ? "text-emerald-700" : ""}`}>{c.name}</div>
                    <div className="text-xs text-gray-600">{c.phone || "—"} {c.email ? "• " + c.email : ""}</div>
                  </button>
                );
              })}
              {clients.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">Nėra įrašų.</div>}
            </div>
          </div>

          {/* Paslauga */}
          <div>
            <div className="text-sm text-gray-600 mb-1">Kategorija</div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setAddForm((f) => ({ ...f, category: cat, serviceId: null }))
                  }
                  className={
                    "inline-flex items-center px-3 py-2 rounded-xl border whitespace-nowrap " +
                    (addForm.category === cat
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white hover:bg-gray-50")
                  }
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Subpaslauga (nebūtina) */}
            {addForm.category && (
              <div className="mt-2 md:w-1/2">
                {subservices.length > 0 ? (
                  <>
                    <div className="text-sm text-gray-600 mb-1">Tikslesnė paslauga (nebūtina)</div>
                    <select
                      className="w-full px-3 py-2 rounded-xl border"
                      value={addForm.serviceId || ""}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, serviceId: e.target.value || null }))
                      }
                    >
                      <option value="">— Tik kategorija —</option>
                      {subservices.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Nuo</div>
              <TimeField value={addForm.start} onChange={(v) => setAddForm((f) => ({ ...f, start: v }))} step={1} />
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Iki</div>
              <TimeField value={addForm.end} onChange={(v) => setAddForm((f) => ({ ...f, end: v }))} step={1} />
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
              />
            </div>
            <div className="md:col-span-4">
              <div className="text-sm text-gray-600 mb-1">Pastabos</div>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl border"
                value={addForm.note}
                onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
              />
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
            <button className="px-3 py-2 rounded-xl border" onClick={() => setNewClientOpen(false)}>Atšaukti</button>
            <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white" onClick={createClient}>Išsaugoti</button>
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
