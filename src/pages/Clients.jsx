// src/pages/Clients.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import Modal from "../components/Modal";

const PAGE_SIZE = 50;

/* Tritaškių meniu per portalą – pataisyta, kad click'ai nepradingtų */
function DotMenu({ anchorRef, open, onClose, items = [] }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef?.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const MENU_W = 208; // ~ w-52
    const P = 8;
    const top = Math.min(window.innerHeight - P, r.bottom + 8);
    let left = r.right - 8 - MENU_W;
    if (left < P) left = P;
    setPos({ top, left });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    // buvo 'pointerdown' – pakeista į 'click', kad neišjungtų meniu PRIEŠ onClick handlerį
    const onDocClick = () => onClose?.();
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed z-[9998] w-52 rounded-xl border bg-white shadow-lg p-1"
      style={{ top: pos.top, left: pos.left }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => (
        <button
          key={i}
          className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm ${
            it.danger ? "text-rose-600 hover:bg-rose-50" : ""
          } ${it.disabled ? "opacity-40 pointer-events-none" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            it.onClick?.();
            onClose?.(); // uždarom tik po veiksmo
          }}
        >
          {it.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

export default function Clients({ workspace }) {
  /* Pranešimai */
  const [msg, setMsg] = useState(null); // {type:'ok'|'error', text:string}
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  /* Paieška / sąrašas / puslapiavimas */
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const searchRef = useRef(null);
  const sentinelRef = useRef(null);

  /* Tritaškių meniu sąraše */
  const [listMenuId, setListMenuId] = useState(null);
  const menuBtnRef = useRef({}); // { [id]: ref }

  /* Naujas klientas (modalas) */
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "", email: "", gender: "female" });
  const [creatingClient, setCreatingClient] = useState(false);
  const newFirstInputRef = useRef(null);

  /* Istorijos modalas (tik istorija) */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [modalMenuOpen, setModalMenuOpen] = useState(false);
  const modalMenuBtnRef = useRef(null);

  /* REDAGAVIMO modalas (atskirai, kad 100% veiktų) */
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, name: "", phone: "", email: "", gender: "female" });

  /* Fokusas į paiešką atėjus */
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  /* Debounce paieškai */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* Pirmas/atkurtas užkrovimas */
  useEffect(() => {
    resetAndLoad();
  }, [workspace?.id, debouncedSearch]);

  async function resetAndLoad() {
    if (!workspace?.id) { setList([]); return; }
    setHasMore(true);
    setList([]);
    await loadPage({ reset: true });
  }

  async function loadPage({ reset = false } = {}) {
    if (!workspace?.id) return;
    const offset = reset ? 0 : list.length;
    const from = offset;
    const to = offset + PAGE_SIZE - 1;

    if (reset) setLoadingList(true);
    else setLoadingMore(true);

    let q = supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true })
      .range(from, to);

    if (debouncedSearch) q = q.ilike("name", `%${debouncedSearch}%`);

    const { data, error } = await q;

    if (reset) setLoadingList(false);
    else setLoadingMore(false);

    if (error) {
      setMsg({ type: "error", text: error.message });
      if (reset) setList([]);
      return;
    }

    const chunk = data || [];
    setList((prev) => (reset ? chunk : [...prev, ...chunk]));
    setHasMore(chunk.length === PAGE_SIZE);
  }

  /* Begalinis scroll */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loadingList) {
          loadPage({ reset: false });
        }
      },
      { root: null, rootMargin: "600px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadingList, list.length, debouncedSearch, workspace?.id]);

  /* Kopijavimas į iškarpinę */
  async function copyToClipboard(label, text) {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setMsg({ type: "ok", text: `${label} nukopijuota.` });
    } catch {
      setMsg({ type: "error", text: `Nepavyko nukopijuoti (${label.toLowerCase()}).` });
    }
  }

  /* Atidaryti kliento istoriją (be redagavimo laukų) */
  async function openHistory(c) {
    if (!workspace?.id) return;
    setSelected(c);
    setHistoryOpen(true);
    setModalMenuOpen(false);
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("*, services(name, category)")
      .eq("workspace_id", workspace.id)
      .eq("client_id", c.id)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });
    setLoadingHistory(false);
    setHistory(error ? [] : data || []);
    if (error) setMsg({ type: "error", text: error.message });
  }

  function closeHistory() {
    setHistoryOpen(false);
    setModalMenuOpen(false);
    setSelected(null);
    setHistory([]);
  }

  /* Atidaryti REDAGAVIMO modalą (visada veiks, nes atskiras) */
  function openEdit(c) {
    const cli = c || selected;
    if (!cli) return;
    setEditForm({
      id: cli.id,
      name: cli.name || "",
      phone: cli.phone || "",
      email: cli.email || "",
      gender: cli.gender || "female",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editForm.id || editSaving) return;
    if (!editForm.name.trim()) { setMsg({ type: "error", text: "Įveskite vardą ir pavardę." }); return; }

    const payload = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      gender: editForm.gender || "female",
    };

    try {
      setEditSaving(true);
      const { data, error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editForm.id)
        .select()
        .single();
      if (error) throw error;

      // Atnaujinam sąrašą
      setList((prev) =>
        prev
          .map((x) => (x.id === editForm.id ? data : x))
          .sort((a, b) => a.name.localeCompare(b.name, "lt", { sensitivity: "base" }))
      );

      // Jei atidaryta istorija šio kliento – atnaujinti header duomenis
      setSelected((prev) => (prev && prev.id === editForm.id ? data : prev));

      setMsg({ type: "ok", text: "Pakeitimai išsaugoti." });
      setEditOpen(false);
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko išsaugoti." });
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteClient(c) {
    const cli = c || selected;
    if (!cli) return;
    const ok = window.confirm(`Ar tikrai norite ištrinti „${cli.name}“?`);
    if (!ok) return;

    const prev = list;
    setList((cur) => cur.filter((x) => x.id !== cli.id));
    try {
      const { error } = await supabase.from("clients").delete().eq("id", cli.id);
      if (error) throw error;
      setMsg({ type: "ok", text: "Klientas pašalintas." });
      if (selected?.id === cli.id) closeHistory();
      setEditOpen(false);
    } catch (e) {
      setList(prev);
      const txt =
        (e?.message || "").toLowerCase().includes("foreign key") ||
        (e?.details || "").toLowerCase().includes("violates")
          ? "Šio kliento pašalinti nepavyko: yra susietų rezervacijų."
          : e.message || "Nepavyko pašalinti kliento.";
      setMsg({ type: "error", text: txt });
    }
  }

  /* Meniu elementai: tik „Redaguoti“ ir „Ištrinti klientą“ */
  const rowMenuItems = (c) => ([
    { label: "Redaguoti", onClick: () => openEdit(c) },
    { label: "Ištrinti klientą", danger: true, onClick: () => deleteClient(c) },
  ]);
  const modalMenuItems = useMemo(() => {
    if (!selected) return [];
    return [
      { label: "Redaguoti", onClick: () => openEdit(selected) },
      { label: "Ištrinti klientą", danger: true, onClick: () => deleteClient(selected) },
    ];
  }, [selected]);

  /* Naujo kliento kūrimas */
  async function createClient() {
    if (creatingClient) return;
    if (!newForm.name.trim()) { setMsg({ type: "error", text: "Įveskite vardą ir pavardę." }); return; }
    const payload = {
      name: newForm.name.trim(),
      phone: newForm.phone.trim() || null,
      email: newForm.email.trim() || null,
      gender: newForm.gender || "female",
      workspace_id: workspace.id,
    };
    try {
      setCreatingClient(true);
      const { data, error } = await supabase.from("clients").insert(payload).select().single();
      if (error) throw error;

      setList((prev) => {
        const next = [...prev, data].filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i);
        return next.sort((a, b) => a.name.localeCompare(b.name, "lt", { sensitivity: "base" }));
      });

      setMsg({ type: "ok", text: "Klientas sukurtas." });
      setNewOpen(false);
      setNewForm({ name: "", phone: "", email: "", gender: "female" });
      openHistory(data);
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko sukurti kliento." });
    } finally {
      setCreatingClient(false);
    }
  }

  if (!workspace?.id) {
    return (
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
        Įkeliama darbo vieta...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-3 sm:p-5 space-y-3">
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

      {/* Antraštė + paieška + naujas klientas */}
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="text-base sm:text-lg font-semibold">Klientai</div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            ref={searchRef}
            className="border rounded-xl px-3 py-2 w-full sm:w-72"
            placeholder="Paieška pagal vardą"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Paieška pagal kliento vardą"
          />
          <button
            onClick={() => setNewOpen(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Naujas klientas
          </button>
        </div>
      </div>

      {/* Sąrašas */}
      <div className="divide-y border rounded-2xl bg-white overflow-hidden">
        {loadingList && <div className="px-4 py-3 text-gray-500">Įkeliama...</div>}
        {!loadingList && list.length === 0 && (
          <div className="px-4 py-3 text-gray-500">Nieko nerasta.</div>
        )}
        {!loadingList &&
          list.map((c) => {
            const ref = (menuBtnRef.current[c.id] =
              menuBtnRef.current[c.id] || React.createRef());
            return (
              <div
                key={c.id}
                className="w-full px-3 sm:px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-2"
              >
                {/* Kairė: paspaudus atidaroma istorija (div su role=button) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openHistory(c)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openHistory(c)}
                  className="text-left min-w-0 flex-1 cursor-pointer outline-none focus:ring-2 focus:ring-emerald-300 rounded-lg"
                  aria-label={`Atidaryti kliento ${c.name} istoriją`}
                >
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-sm text-gray-600 truncate flex items-center gap-1 flex-wrap">
                    {/* Telefonas – kopijuojasi paspaudus */}
                    {c.phone ? (
                      <button
                        type="button"
                        title="Spauskite, kad nukopijuotumėte telefoną"
                        className="underline decoration-dotted hover:decoration-solid hover:text-gray-800"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard("Telefonas", c.phone); }}
                      >
                        {c.phone}
                      </button>
                    ) : (
                      <span>—</span>
                    )}
                    {c.email && <span>•</span>}
                    {/* El. paštas – kopijuojasi paspaudus */}
                    {c.email && (
                      <button
                        type="button"
                        title="Spauskite, kad nukopijuotumėte el. paštą"
                        className="underline decoration-dotted hover:decoration-solid hover:text-gray-800"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard("El. paštas", c.email); }}
                      >
                        {c.email}
                      </button>
                    )}
                  </div>
                </div>

                {/* Dešinė: tritaškis */}
                <div className="shrink-0">
                  <button
                    ref={ref}
                    className="w-10 h-10 sm:w-auto sm:h-auto sm:p-2 p-0.5 rounded-lg border hover:bg-gray-50 flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      setListMenuId(listMenuId === c.id ? null : c.id);
                    }}
                    aria-label="Daugiau veiksmų"
                  >
                    ⋯
                  </button>
                </div>

                <DotMenu
                  anchorRef={ref}
                  open={listMenuId === c.id}
                  onClose={() => setListMenuId(null)}
                  items={[
                    { label: "Redaguoti", onClick: () => openEdit(c) },
                    { label: "Ištrinti klientą", danger: true, onClick: () => deleteClient(c) },
                  ]}
                />
              </div>
            );
          })}
        {/* Sentinel begaliniam scroll */}
        <div ref={sentinelRef} />
      </div>

      {/* Atsarginis „Rodyti daugiau“ mygtukas */}
      {!loadingList && hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => loadPage({ reset: false })}
            className="px-4 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50"
            disabled={loadingMore}
          >
            {loadingMore ? "Kraunama..." : "Rodyti daugiau"}
          </button>
        </div>
      )}

      {/* Modalas: Naujas klientas */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Naujas klientas"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setNewOpen(false)}>
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
        <div className="max-h-[70vh] overflow-y-auto pr-1 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              ref={newFirstInputRef}
              className="px-3 py-2 rounded-xl border"
              placeholder="Vardas ir pavardė"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
            />
            <input
              className="px-3 py-2 rounded-xl border"
              placeholder="Telefonas"
              value={newForm.phone}
              onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
            />
            <input
              className="px-3 py-2 rounded-xl border"
              placeholder="El. paštas"
              value={newForm.email}
              onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
            />
            <select
              className="px-3 py-2 rounded-xl border"
              value={newForm.gender}
              onChange={(e) => setNewForm({ ...newForm, gender: e.target.value })}
            >
              <option value="female">Moteris</option>
              <option value="male">Vyras</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Modalas: Kliento istorija */}
      <Modal
        open={historyOpen}
        onClose={closeHistory}
        title={
          <div className="flex items-center justify-between gap-2">
            <span className="truncate pr-2">{selected ? selected.name : "Klientas"}</span>

            {/* Greiti kopijavimo „žetonai“ */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
              {selected?.phone && (
                <button
                  className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                  title="Kopijuoti telefoną"
                  onClick={() => copyToClipboard("Telefonas", selected.phone)}
                >
                  {selected.phone}
                </button>
              )}
              {selected?.email && (
                <button
                  className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                  title="Kopijuoti el. paštą"
                  onClick={() => copyToClipboard("El. paštas", selected.email)}
                >
                  {selected.email}
                </button>
              )}
            </div>

            {selected && (
              <>
                <button
                  ref={modalMenuBtnRef}
                  className="w-10 h-10 sm:w-auto sm:h-auto sm:p-2 p-0.5 rounded-lg border hover:bg-gray-50 ml-2 flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalMenuOpen((v) => !v);
                  }}
                  aria-label="Daugiau veiksmų"
                >
                  ⋯
                </button>
                <DotMenu
                  anchorRef={modalMenuBtnRef}
                  open={modalMenuOpen}
                  onClose={() => setModalMenuOpen(false)}
                  items={modalMenuItems}
                />
              </>
            )}
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-1 pb-[env(safe-area-inset-bottom)]">
          {!selected ? (
            <div className="text-gray-500">Pasirinkite klientą.</div>
          ) : (
            <div className="-mx-2 overflow-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-2">Data</th>
                    <th className="p-2">Laikas</th>
                    <th className="p-2">Paslauga</th>
                    <th className="p-2">Kaina</th>
                    <th className="p-2">Pastabos</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHistory && (
                    <tr>
                      <td className="p-2 text-gray-500" colSpan="5">Įkeliama...</td>
                    </tr>
                  )}
                  {!loadingHistory &&
                    history.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-2 whitespace-nowrap">{a.date}</td>
                        <td className="p-2 whitespace-nowrap">
                          {a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}
                        </td>
                        <td className="p-2">
                          {a.services?.category}
                          {a.services?.name ? " • " + a.services.name : ""}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {a.price ? `${a.price} €` : "—"}
                        </td>
                        <td className="p-2">{a.note || "—"}</td>
                      </tr>
                    ))}
                  {!loadingHistory && history.length === 0 && (
                    <tr>
                      <td className="p-2 text-gray-500" colSpan="5">
                        Šis klientas dar neturi įrašų.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Modalas: REDAGUOTI klientą (atskirai) */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Redaguoti klientą"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded-xl border" onClick={() => setEditOpen(false)}>
              Atšaukti
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
              onClick={saveEdit}
              disabled={editSaving}
            >
              {editSaving ? "Saugoma..." : "Išsaugoti"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Vardas ir pavardė *</div>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Telefonas</div>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">El. paštas</div>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Lytis</div>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.gender}
              onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
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
