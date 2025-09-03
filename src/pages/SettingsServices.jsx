// src/pages/SettingsServices.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import Modal from "../components/Modal";

export default function SettingsServices({ workspace }) {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState(null); // {type:'ok'|'error', text:string}

  // Kurti paslaugą (kategoriją + (nebūtinas) sąrašas subkategorijų)
  const [createOpen, setCreateOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [categoryPrice, setCategoryPrice] = useState("");
  const [rows, setRows] = useState([{ name: "", price: "" }]);

  // Redaguoti vieną įrašą
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, category: "", name: "", price: "" });

  async function load() {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setList(data || []);
  }
  useEffect(() => { load(); }, [workspace.id]);

  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase();
    return (list || []).filter(
      (x) =>
        (x.category || "").toLowerCase().includes(s) ||
        (x.name || "").toLowerCase().includes(s)
    );
  }, [list, q]);

  /* ---------- Kurti paslaugą ---------- */
  function resetCreateForm() {
    setCatName(""); setCategoryPrice(""); setRows([{ name: "", price: "" }]);
  }
  function addRow() { setRows((r) => [...r, { name: "", price: "" }]); }
  function removeRow(i) { setRows((r) => r.filter((_, idx) => idx !== i)); }
  function setRow(i, patch) { setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row))); }

  async function createServices() {
    setMsg(null);
    const category = catName.trim();
    if (!category) { setMsg({ type: "error", text: "Įrašykite kategorijos pavadinimą." }); return; }

    const subs = rows
      .map((r) => ({ name: (r.name || "").trim(), price: r.price }))
      .filter((r) => r.name.length > 0);

    const payloads = [];
    if (subs.length === 0) {
      // Tik kategorija
      payloads.push({
        workspace_id: workspace.id,
        category,
        name: null,
        default_price: categoryPrice !== "" ? Number(categoryPrice) : null,
      });
    } else {
      subs.forEach((r) => {
        payloads.push({
          workspace_id: workspace.id,
          category,
          name: r.name,
          default_price: r.price !== "" ? Number(r.price) : null,
        });
      });
    }

    const { error } = await supabase.from("services").insert(payloads);
    if (error) { setMsg({ type: "error", text: error.message }); return; }

    setMsg({ type: "ok", text: subs.length === 0 ? "Kategorija sukurta." : `Sukurta ${subs.length} subkategor.${subs.length === 1 ? "a" : "os"}.` });
    resetCreateForm();
    setCreateOpen(false);
    await load();
  }

  /* ---------- Redaguoti įrašą ---------- */
  function openEdit(svc) {
    setEditForm({
      id: svc.id,
      category: svc.category || "",
      name: svc.name || "",
      price: svc.default_price ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    const id = editForm.id;
    if (!id) return;

    if (!editForm.category.trim()) {
      setMsg({ type: "error", text: "Kategorija negali būti tuščia." });
      return;
    }

    const payload = {
      category: editForm.category.trim(),
      name: editForm.name.trim() ? editForm.name.trim() : null,
      default_price: editForm.price !== "" ? Number(editForm.price) : null,
    };

    const { error } = await supabase.from("services").update(payload).eq("id", id);
    if (error) { setMsg({ type: "error", text: error.message }); return; }

    setMsg({ type: "ok", text: "Pakeitimai išsaugoti." });
    setEditOpen(false);
    await load();
  }

  /* ---------- Šalinimai ---------- */
  async function removeService(id) {
    setMsg(null);
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "ok", text: "Įrašas pašalintas." });
    await load();
  }

  async function removeCategory(category) {
    setMsg(null);
    const ok = window.confirm(`Ar tikrai norite ištrinti kategoriją „${category}“?\nBus pašalintos ir visos jos subkategorijos.`);
    if (!ok) return;
    const { error } = await supabase
      .from("services")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("category", category);
    if (error) { setMsg({ type: "error", text: error.message }); return; }
    setMsg({ type: "ok", text: `Kategorija „${category}“ pašalinta.` });
    await load();
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5 space-y-4">
      {/* Viršuje – paieška ir mygtukas */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        {/* Nebelieka „Nustatymai → Paslaugos“ */}
        <div className="flex gap-2">
          <input
            className="border rounded-xl px-3 py-2 w-full sm:w-64"
            placeholder="Paieška"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            onClick={() => { setMsg(null); setCreateOpen(true); }}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
          >
            Kurti paslaugą
          </button>
        </div>
      </div>

      {/* Paprasta instrukcija */}
<div className="rounded-2xl border p-4 bg-white text-gray-800">
  <div className="font-medium mb-2">Kaip naudoti paslaugas?</div>
  <ul className="list-disc pl-5 space-y-1 text-sm">
    <li>
      <b>Kategorija</b> – didelė grupė (pvz. <i>Konsultacija</i>, <i>Kirpimas</i>).
      Jei kuri tik kategoriją, lauką <b>„Subkategorija“</b> palik tuščią.
    </li>
    <li>
      <b>Subkategorija</b> – konkretus variantas (pvz. <i>Vyriškas</i>, <i>Balayage</i>).
      Kiekvienas variantas – atskira eilutė.
    </li>
    <li>
      <b>Numatyta kaina</b> – įrašyk ten, kur ji galioja. Rezervacijoje kaina
      užsipildys automatiškai pagal pasirinktą subkategoriją arba, jei jos nėra,
      pagal „tik kategoriją“.
    </li>
  </ul>
</div>


      {msg && (
        <div className={`px-3 py-2 rounded-xl text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {msg.text}
        </div>
      )}

      <div className="-mx-2 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="p-2">Kategorija</th>
              <th className="p-2">Subkategorija</th>
              <th className="p-2">Kaina (numatyta)</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((svc) => (
              <tr key={svc.id} className="border-t">
                <td className="p-2">{svc.category}</td>
                <td className="p-2">{svc.name ?? "—"}</td>
                <td className="p-2">{svc.default_price != null ? `${svc.default_price} €` : "—"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(svc)}
                      className="px-3 py-1 rounded-xl border"
                    >
                      Koreguoti
                    </button>
                    <button
                      onClick={() => removeCategory(svc.category)}
                      className="px-3 py-1 rounded-xl border text-red-600"
                      title="Pašalins visą kategoriją ir visas jos subkategorijas"
                    >
                      Šalinti kategoriją
                    </button>
                    <button
                      onClick={() => removeService(svc.id)}
                      className="px-3 py-1 rounded-xl border text-rose-600"
                      title="Pašalinti tik šią eilutę"
                    >
                      Šalinti eilutę
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="p-2 text-gray-500" colSpan="4">Nėra įrašų.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modalas: Kurti paslaugą */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); }}
        title="Kurti paslaugą"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreateOpen(false)} className="px-3 py-2 rounded-xl border">Atšaukti</button>
            <button onClick={createServices} className="px-3 py-2 rounded-xl bg-emerald-600 text-white">Išsaugoti</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Kategorija *</div>
            <input
              className="w-full border rounded-xl px-3 py-2"
              placeholder='pvz. "Dažymas", "Depiliavimas"'
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Kategorijos kaina (nebūtina)</div>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded-xl px-3 py-2"
              placeholder="pvz. 30"
              value={categoryPrice}
              onChange={(e) => setCategoryPrice(e.target.value)}
            />
            <div className="text-xs text-gray-500 mt-1">
              Jei nepridėsi subkategorijų – bus sukurta tik kategorija su (nebūtina) kaina.
            </div>
          </div>

          <div className="border rounded-2xl p-3 space-y-2">
            <div className="font-medium">Subkategorijos (nebūtina)</div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input
                  className="sm:col-span-3 border rounded-xl px-3 py-2"
                  placeholder="Subkategorijos pavadinimas (pvz., Balayage)"
                  value={r.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  className="sm:col-span-2 border rounded-xl px-3 py-2"
                  placeholder="Kaina (€)"
                  value={r.price}
                  onChange={(e) => setRow(i, { price: e.target.value })}
                />
                <div className="flex gap-2">
                  <button onClick={() => removeRow(i)} className="px-2 py-1 rounded-lg border text-sm">
                    Šalinti eilutę
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
            <button onClick={() => setEditOpen(false)} className="px-3 py-2 rounded-xl border">Atšaukti</button>
            <button onClick={saveEdit} className="px-3 py-2 rounded-xl bg-emerald-600 text-white">Išsaugoti</button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Kategorija</div>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Subkategorija (nebūtina)</div>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder="palik tuščią, jei tai tik kategorija"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Kaina (nebūtina)</div>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.price}
              onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
