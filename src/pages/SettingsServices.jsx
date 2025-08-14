// src/pages/SettingsServices.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import Modal from "../components/Modal";

const DEFAULT_GRAY = "#e5e7eb"; // kai color === null/tuščia

/* ─────────────────────────────
 * Mažas Tooltip komponentas (per portalą, kad "overflow" neužmaskuotų)
 * ───────────────────────────── */
function Tooltip({ content, children, side = "top" }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const place = useCallback(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const padding = 10;
    const top = side === "top" ? r.top - padding : r.bottom + padding;
    const left = r.left + r.width / 2;
    setPos({ top, left });
  }, [side]);

  useEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    const onResize = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, place]);

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex items-center align-middle cursor-help"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        aria-haspopup="true"
        aria-label="Pagalba"
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            role="tooltip"
            style={{
              top: pos.top,
              left: pos.left,
              transform:
                side === "top"
                  ? "translate(-50%,-100%)"
                  : "translate(-50%,0%)",
            }}
          >
            <div className="max-w-xs rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-lg">
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/* Paprastas trijų taškų meniu per portalą (kad neužkliptų) */
function DotMenu({ anchorRef, open, onClose, items = [] }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const firstBtnRef = useRef(null);

  useEffect(() => {
    if (!open || !anchorRef?.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.right - 8 });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => onClose?.();
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("click", onDoc);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("click", onDoc);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && firstBtnRef.current) firstBtnRef.current.focus();
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed z-[9998] w-52 rounded-xl border bg-white shadow-lg p-1"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      {items.map((it, i) => (
        <button
          key={i}
          ref={i === 0 ? firstBtnRef : null}
          className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm ${
            it.danger ? "text-rose-600 hover:bg-rose-50" : ""
          }`}
          onClick={() => {
            it.onClick?.();
            onClose?.();
          }}
          role="menuitem"
        >
          {it.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

/* Nedidelis šauktuko apskritimo ikonėlių komponentas */
function HelpDot() {
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-gray-200 text-gray-700 ml-1 select-none"
      aria-hidden="true"
    >
      i
    </span>
  );
}

/* ───────────── helpers ───────────── */
const norm = (v) => (v ?? "").toString().trim();
const validHex = (v) =>
  v === "" ||
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);

const byCatThenName = (a, b) => {
  const ac = norm(a.category).toLocaleLowerCase("lt");
  const bc = norm(b.category).toLocaleLowerCase("lt");
  if (ac !== bc) return ac.localeCompare(bc, "lt", { sensitivity: "base" });
  // name NULL/"" pirmiau (kaip kategorijos-eilutė)
  const an = norm(a.name).toLocaleLowerCase("lt");
  const bn = norm(b.name).toLocaleLowerCase("lt");
  if (an === "" && bn !== "") return -1;
  if (an !== "" && bn === "") return 1;
  return an.localeCompare(bn, "lt", { sensitivity: "base" });
};

export default function SettingsServices({ workspace }) {
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  const [msg, setMsg] = useState(null); // {type:'ok'|'error', text:string}

  // Kurti paslaugą (kategorija + (nebūtinas) sąrašas subkategorijų)
  const [createOpen, setCreateOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [categoryPrice, setCategoryPrice] = useState("");
  const [categoryColor, setCategoryColor] = useState(""); // tuščia = numatyta (pilka)
  const [excludeFromStats, setExcludeFromStats] = useState(false);
  const [rows, setRows] = useState([{ name: "", price: "", color: "" }]);
  const [creating, setCreating] = useState(false);
  const createFirstInputRef = useRef(null);

  // Redaguoti vieną įrašą
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    category: "",
    name: "",
    price: "",
    color: "", // tuščia = numatyta (pilka)
    exclude: false,
  });
  const [saving, setSaving] = useState(false);
  const editFirstInputRef = useRef(null);

  // Dots meniu būsena (lentelės eilutėms)
  const [menuId, setMenuId] = useState(null);
  const menuBtnRef = useRef({}); // { [id]: ref }
  const [deletingId, setDeletingId] = useState(null);

  /* ---------- Užkrovimas ---------- */
  async function load() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    setLoadingList(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
      return;
    }
    setList(data || []);
  }

  useEffect(() => {
    load();
  }, [workspace.id]);

  /* ---------- Debounce q ---------- */
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  /* ---------- Auto-dismiss pranešimai ---------- */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  const filtered = useMemo(() => {
    const s = (qDebounced || "").toLowerCase();
    return (list || []).filter(
      (x) =>
        (x.category || "").toLowerCase().includes(s) ||
        (x.name || "").toLowerCase().includes(s)
    );
  }, [list, qDebounced]);

  /* ---------- Kurti paslaugą ---------- */
  function resetCreateForm() {
    setCatName("");
    setCategoryPrice("");
    setCategoryColor(""); // numatyta (pilka)
    setExcludeFromStats(false);
    setRows([{ name: "", price: "", color: "" }]);
  }
  function addRow() {
    setRows((r) => [...r, { name: "", price: "", color: "" }]);
  }
  function removeRow(i) {
    const label = rows[i]?.name?.trim() || "subkategoriją";
    const ok = window.confirm(`Ar tikrai norite ištrinti „${label}“?`);
    if (!ok) return;
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function setRow(i, patch) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  // fokusas į pirmą lauką atidarius "Kurti"
  useEffect(() => {
    if (createOpen && createFirstInputRef.current) {
      createFirstInputRef.current.focus();
    }
  }, [createOpen]);

  // Enter=Išsaugoti, Esc=Uždaryti (kurti)
  const onCreateKeyDown = (e) => {
    if (e.key === "Escape") setCreateOpen(false);
    if (e.key === "Enter" && !creating) {
      e.preventDefault();
      createServices();
    }
  };

  // paprastos validacijos vienoje vietoje
  function validateCreate() {
    const category = norm(catName);
    if (!category) return { ok: false, reason: "Įrašykite kategorijos pavadinimą." };

    if (!validHex(categoryColor)) {
      return { ok: false, reason: "Neteisinga kategorijos spalvos reikšmė." };
    }
    if (categoryPrice !== "" && Number(categoryPrice) < 0) {
      return { ok: false, reason: "Kaina negali būti neigiama." };
    }

    // subkategorijų dublikatai pagal pavadinimą (toje pačioje kategorijoje)
    const subs = rows
      .map((r) => norm(r.name))
      .filter((n) => n.length > 0);
    const dup = subs.find((n, i) => subs.indexOf(n) !== i);
    if (dup) {
      return { ok: false, reason: `Subkategorija „${dup}“ dubliuojasi.` };
    }

    // spalvų ir kainų validacija sub'ams
    for (const r of rows) {
      if (!validHex(norm(r.color))) {
        return { ok: false, reason: `Neteisinga spalva subkategorijai „${norm(r.name) || "—"}“. ` };
      }
      if (norm(r.price) !== "" && Number(r.price) < 0) {
        return { ok: false, reason: `Kaina negali būti neigiama subkategorijai „${norm(r.name) || "—"}“. ` };
      }
    }

    return { ok: true };
  }

  async function createServices() {
    if (creating) return;
    setMsg(null);

    const v = validateCreate();
    if (!v.ok) {
      setMsg({ type: "error", text: v.reason });
      return;
    }

    const category = norm(catName);
    const subs = rows
      .map((r) => ({
        name: norm(r.name),
        price: norm(r.price),
        color: norm(r.color),
      }))
      .filter((r) => r.name.length > 0);

    const payloads = [];
    if (subs.length === 0) {
      payloads.push({
        workspace_id: workspace.id,
        category,
        name: null,
        default_price: categoryPrice !== "" ? Number(categoryPrice) : null,
        color: categoryColor || null, // jei tuščia – NULL (numatyta pilka)
        exclude_from_stats: !!excludeFromStats,
      });
    } else {
      subs.forEach((r) => {
        payloads.push({
          workspace_id: workspace.id,
          category,
          name: r.name,
          default_price: r.price !== "" ? Number(r.price) : null,
          color: (r.color || categoryColor) || null, // jei sub spalva tuščia -> paveldi kategorijos; jei ir kategorijos tuščia -> NULL
          exclude_from_stats: !!excludeFromStats, // subkategorijos paveldi vėliavą
        });
      });
    }

    try {
      setCreating(true);
      // grąžinam sukurtus įrašus, kad galėtume vietoje atnaujinti
      const { data, error } = await supabase.from("services").insert(payloads).select("*");
      if (error) throw error;

      setList((prev) => {
        const next = [...prev, ...(data || [])];
        next.sort(byCatThenName);
        return next;
      });

      setMsg({
        type: "ok",
        text:
          subs.length === 0
            ? "Kategorija sukurta."
            : `Sukurta ${subs.length} subkategor.${subs.length === 1 ? "a" : "os"}.`,
      });
      resetCreateForm();
      setCreateOpen(false);
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko sukurti." });
    } finally {
      setCreating(false);
    }
  }

  /* ---------- Redaguoti įrašą ---------- */
  function openEdit(svc) {
    setEditForm({
      id: svc.id,
      category: svc.category || "",
      name: svc.name || "",
      price: svc.default_price ?? "",
      color: svc.color || "", // laikom tuščią kaip „numatytą“
      exclude: !!svc.exclude_from_stats,
    });
    setEditOpen(true);
  }

  // fokusas į pirmą lauką atidarius "Koreguoti"
  useEffect(() => {
    if (editOpen && editFirstInputRef.current) {
      editFirstInputRef.current.focus();
    }
  }, [editOpen]);

  // Enter=Išsaugoti, Esc=Uždaryti (edit)
  const onEditKeyDown = (e) => {
    if (e.key === "Escape") setEditOpen(false);
    if (e.key === "Enter" && !saving) {
      e.preventDefault();
      saveEdit();
    }
  };

  function validateEdit() {
    if (!norm(editForm.category)) {
      return { ok: false, reason: "Kategorija negali būti tuščia." };
    }
    if (!validHex(norm(editForm.color))) {
      return { ok: false, reason: "Neteisinga spalvos reikšmė." };
    }
    if (norm(editForm.price) !== "" && Number(editForm.price) < 0) {
      return { ok: false, reason: "Kaina negali būti neigiama." };
    }
    return { ok: true };
  }

  async function saveEdit() {
    if (saving) return;
    const id = editForm.id;
    if (!id) return;

    const v = validateEdit();
    if (!v.ok) {
      setMsg({ type: "error", text: v.reason });
      return;
    }

    const payload = {
      category: norm(editForm.category),
      name: norm(editForm.name) ? norm(editForm.name) : null,
      default_price: norm(editForm.price) !== "" ? Number(editForm.price) : null,
      color: norm(editForm.color) || null, // tuščia -> NULL (numatyta pilka)
      exclude_from_stats: !!editForm.exclude,
    };

    try {
      setSaving(true);
      const { error } = await supabase.from("services").update(payload).eq("id", id);
      if (error) throw error;

      // Optimistiškai atnaujinam
      setList((prev) => {
        const next = prev.map((x) => (x.id === id ? { ...x, ...payload } : x));
        next.sort(byCatThenName);
        return next;
      });

      setMsg({ type: "ok", text: "Pakeitimai išsaugoti." });
      setEditOpen(false);
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Nepavyko išsaugoti." });
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Šalinimai ---------- */
  async function removeService(id) {
    setMsg(null);
    // Optimistic UI
    setDeletingId(id);
    const prev = list;
    setList((cur) => cur.filter((x) => x.id !== id));
    try {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
      setMsg({ type: "ok", text: "Paslauga pašalinta." });
    } catch (e) {
      // rollback
      setList(prev);
      setMsg({ type: "error", text: e.message || "Nepavyko pašalinti." });
    } finally {
      setDeletingId(null);
    }
  }
  function confirmAndRemoveService(svc) {
    const label = svc.name ? `${svc.name} (${svc.category})` : svc.category;
    const ok = window.confirm(`Ar tikrai norite ištrinti „${label}“ paslaugą?`);
    if (!ok) return;
    removeService(svc.id);
  }

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="text-lg font-semibold">Paslaugos</div>
        <div className="flex gap-2">
          <input
            className="border rounded-xl px-3 py-2 w-full sm:w-64"
            placeholder="Paieška"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Paieška pagal kategoriją ar subkategoriją"
          />
          <button
            onClick={() => {
              setMsg(null);
              setCreateOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
            disabled={loadingList}
          >
            Kurti paslaugą
          </button>
        </div>
      </div>

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

      {/* Lentelė */}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="p-2">
                <div className="inline-flex items-center">
                  Kategorija
                  <Tooltip
                    content={
                      <>
                        „Kategorija“ – platesnė paslaugų grupė. Pvz.,
                        „Kirpimas“, „Dažymas“.
                      </>
                    }
                  >
                    <HelpDot />
                  </Tooltip>
                </div>
              </th>
              <th className="p-2">
                <div className="inline-flex items-center">
                  Subkategorija
                  <Tooltip
                    content={
                      <>
                        Subkategorija – konkretesnė paslauga kategorijos
                        viduje. Pvz., „Balayage“ kategorijoje „Dažymas“.
                      </>
                    }
                  >
                    <HelpDot />
                  </Tooltip>
                </div>
              </th>
              <th className="p-2">
                <div className="inline-flex items-center">
                  Kaina (numatyta)
                  <Tooltip
                    content={
                      <>
                        Numatyta kaina, kuri bus pasiūlyta kuriant įrašą. Visada
                        galėsite ją pakeisti.
                      </>
                    }
                  >
                    <HelpDot />
                  </Tooltip>
                </div>
              </th>
              <th className="p-2">
                <div className="inline-flex items-center">
                  Statistika
                  <Tooltip
                    content={
                      <>
                        Ar paslauga įtraukiama į statistiką. Žalia – įtraukta,
                        raudona – neįtraukta.
                      </>
                    }
                  >
                    <HelpDot />
                  </Tooltip>
                </div>
              </th>
              <th className="p-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {loadingList && (
              <tr>
                <td className="p-2 text-gray-500" colSpan="5">
                  Įkeliama...
                </td>
              </tr>
            )}
            {!loadingList &&
              filtered.map((svc) => {
                const ref = (menuBtnRef.current[svc.id] =
                  menuBtnRef.current[svc.id] || React.createRef());
                const isDeleting = deletingId === svc.id;
                return (
                  <tr key={svc.id} className={`border-t ${isDeleting ? "opacity-50" : ""}`}>
                    <td className="p-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                        style={{ backgroundColor: svc.color || DEFAULT_GRAY }}
                        title={svc.color || "numatyta (pilka)"}
                        aria-hidden="true"
                      />
                      {svc.category}
                    </td>
                    <td className="p-2">{svc.name ?? "—"}</td>
                    <td className="p-2">
                      {svc.default_price != null ? `${svc.default_price} €` : "—"}
                    </td>
                    <td className="p-2">
                      {/* Žalia = įtraukta, raudona = neįtraukta */}
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
                          svc.exclude_from_stats ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        title={
                          svc.exclude_from_stats
                            ? "Neįtraukiama į statistiką"
                            : "Įtraukiama į statistiką"
                        }
                        aria-label={
                          svc.exclude_from_stats
                            ? "Neįtraukiama į statistiką"
                            : "Įtraukiama į statistiką"
                        }
                      />
                    </td>
                    <td className="p-2">
                      <button
                        ref={ref}
                        className="p-2 rounded-lg border hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(menuId === svc.id ? null : svc.id);
                        }}
                        aria-label="Daugiau veiksmų"
                        disabled={isDeleting}
                      >
                        ⋯
                      </button>

                      <DotMenu
                        anchorRef={ref}
                        open={menuId === svc.id}
                        onClose={() => setMenuId(null)}
                        items={[
                          {
                            label: "Koreguoti",
                            onClick: () => openEdit(svc),
                          },
                          {
                            label: "Šalinti paslaugą",
                            danger: true,
                            onClick: () => confirmAndRemoveService(svc),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            {!loadingList && filtered.length === 0 && (
              <tr>
                <td className="p-2 text-gray-500" colSpan="5">
                  Nėra įrašų.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modalas: Kurti paslaugą */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Kurti paslaugą"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setCreateOpen(false)}
              className="px-3 py-2 rounded-xl border"
            >
              Atšaukti
            </button>
            <button
              onClick={createServices}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
              disabled={creating}
            >
              {creating ? "Saugoma..." : "Išsaugoti"}
            </button>
          </div>
        }
      >
        <div className="space-y-3" onKeyDown={onCreateKeyDown}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Kategorija *</div>
              <input
                ref={createFirstInputRef}
                className="w-full border rounded-xl px-3 py-2"
                placeholder='pvz. „Dažymas“, „Depiliavimas“'
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">
                Kategorijos spalva (nebūtina)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-10 h-10 p-0 border rounded-xl"
                  value={categoryColor || DEFAULT_GRAY}
                  onChange={(e) => setCategoryColor(e.target.value)}
                  title={categoryColor || "numatyta (pilka)"}
                  aria-label="Kategorijos spalva"
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl border"
                  onClick={() => setCategoryColor("")}
                  title="Grąžinti į numatytą (pilką)"
                >
                  Grąžinti į numatytą
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">
                Kategorijos kaina (nebūtina)
              </div>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded-xl px-3 py-2"
                placeholder="pvz. 30"
                value={categoryPrice}
                onChange={(e) => setCategoryPrice(e.target.value)}
                min="0"
              />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 mt-5 sm:mt-0">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={excludeFromStats}
                onChange={(e) => setExcludeFromStats(e.target.checked)}
              />
              <span className="text-sm">
                Neįtraukti šios kategorijos (ir jos subkategorijų) į statistiką
              </span>
            </label>
          </div>

          <div className="border rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              Subkategorijos
              <Tooltip
                side="top"
                content={
                  <>
                    Subkategorijos – konkretesnės paslaugos kategorijos viduje.
                    Pvz., „Balayage“ kategorijoje „Dažymas“. Jos nėra
                    privalomos.
                  </>
                }
              >
                <HelpDot />
              </Tooltip>
            </div>

            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-center rounded-xl"
              >
                {/* Sumažintas pavadinimo laukas, kad tilptų spalva */}
                <input
                  className="col-span-6 border rounded-xl px-3 py-2"
                  placeholder="Subkategorija"
                  value={r.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  className="col-span-3 border rounded-xl px-3 py-2"
                  placeholder="€"
                  value={r.price}
                  onChange={(e) => setRow(i, { price: e.target.value })}
                  min="0"
                />
                <div className="col-span-2 flex items-center">
                  <input
                    type="color"
                    className="w-10 h-10 p-0 border rounded-xl"
                    title="Spalva (nebūtina)"
                    value={r.color || DEFAULT_GRAY}
                    onChange={(e) => setRow(i, { color: e.target.value })}
                    aria-label="Subkategorijos spalva"
                  />
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-rose-50"
                    title="Šalinti eilutę"
                    onClick={() => removeRow(i)}
                    aria-label="Šalinti eilutę"
                  >
                    {/* ryškesnė šiukšliadėžė */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 text-rose-600"
                    >
                      <path d="M9 3h6a1 1 0 0 1 1 1v1h4a1 1 0 1 1 0 2h-1.1l-1.04 12.02A3 3 0 0 1 14.87 23H9.13a3 3 0 0 1-2.99-2.98L5.1 7H4a1 1 0 1 1 0-2h4V4a1 1 0 0 1 1-1Zm2 0v1h2V3h-2ZM7.1 7l1.02 11.8a1 1 0 0 0 1 .9h5.74a1 1 0 0 0 1-.9L16.9 7H7.1Zm3.4 3a1 1 0 1 1 2 0v7a1 1 0 1 1-2 0v-7Zm-3 0a1 1 0 1 1 2 0v7a1 1 0 1 1-2 0v-7Zm8 0a1 1 0 1 1 2 0v7a1 1 0 1 1-2 0v-7Z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addRow} className="px-3 py-2 rounded-xl border">
              + Pridėti eilutę
            </button>
          </div>
        </div>
      </Modal>

      {/* Modalas: Koreguoti įrašą */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Koreguoti paslaugą"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditOpen(false)}
              className="px-3 py-2 rounded-xl border"
            >
              Atšaukti
            </button>
            <button
              onClick={saveEdit}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Saugoma..." : "Išsaugoti"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" onKeyDown={onEditKeyDown}>
          <div>
            <div className="text-xs text-gray-500 mb-1">Kategorija</div>
            <input
              ref={editFirstInputRef}
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.category}
              onChange={(e) =>
                setEditForm({ ...editForm, category: e.target.value })
              }
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">
              Subkategorija (nebūtina)
            </div>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              placeholder="palikite tuščią, jei tai tik kategorija"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Kaina (nebūtina)</div>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.price}
              onChange={(e) =>
                setEditForm({ ...editForm, price: e.target.value })
              }
              min="0"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Spalva (nebūtina)</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-10 p-0 border rounded-xl"
                value={editForm.color || DEFAULT_GRAY}
                onChange={(e) =>
                  setEditForm({ ...editForm, color: e.target.value })
                }
                title={editForm.color || "numatyta (pilka)"}
                aria-label="Spalva"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-xl border"
                onClick={() => setEditForm({ ...editForm, color: "" })}
                title="Grąžinti į numatytą (pilką)"
              >
                Grąžinti į numatytą
              </button>
            </div>
          </div>
          <label className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={editForm.exclude}
              onChange={(e) =>
                setEditForm({ ...editForm, exclude: e.target.checked })
              }
            />
            <span className="text-sm">Neįtraukti į statistiką</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
