import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Modal from "../components/Modal";

function Clients({ workspace }) {
  const [search, setSearch] = useState("");
  const [list, setList] = useState([]);

  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);

  const [open, setOpen] = useState(false);

  // Redagavimui
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", gender: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Pilnos pastabos modaliukas
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteItem, setNoteItem] = useState(null);

  // Kraunam klientų sąrašą pagal workspace + paiešką
  useEffect(() => {
    if (!workspace?.id) {
      setList([]);
      return;
    }

    let cancelled = false;

    (async () => {
      let q = supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("name", { ascending: true })
        .limit(200);

      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q;
      if (!error && !cancelled) setList(data || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace?.id, search]);

  async function openClient(c) {
    if (!workspace?.id) return;

    setSelected(c);
    setForm({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      gender: c.gender || "",
    });
    setEditMode(false);
    setSaveError("");

    const { data } = await supabase
      .from("appointments")
      .select("*, services(name, category)")
      .eq("workspace_id", workspace.id)
      .eq("client_id", c.id)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });

    setHistory(data || []);
    setOpen(true);
  }

  function shorten(text, max = 80) {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "…" : text;
  }

  async function saveClient() {
    if (!selected) return;
    setSaving(true);
    setSaveError("");

    // Minimalus apsivalymas
    const payload = {
      name: (form.name || "").trim(),
      phone: (form.phone || "").trim(),
      email: (form.email || "").trim(),
      gender: (form.gender || "").trim(),
    };

    const { data, error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", selected.id)
      .select()
      .single();

    setSaving(false);

    if (error) {
      setSaveError(error.message || "Nepavyko išsaugoti");
      return;
    }

    // Atnaujinam vietinę būseną
    setSelected(data);
    setList((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    setEditMode(false);
  }

  if (!workspace?.id) {
    return (
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
        Įkeliama darbo vieta...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-lg font-semibold">Klientai</div>
        <input
          className="border rounded-xl px-3 py-2 w-full max-w-xs"
          placeholder="Paieška pagal vardą"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="divide-y border rounded-2xl bg-white overflow-hidden">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => openClient(c)}
            className="w-full text-left px-4 py-3 hover:bg-gray-50"
          >
            <div className="font-medium">{c.name}</div>
            <div className="text-sm text-gray-600">
              {c.phone}
              {c.email ? " • " + c.email : ""}
              {c.gender ? " • " + c.gender : ""}
            </div>
          </button>
        ))}
        {list.length === 0 && (
          <div className="px-4 py-3 text-gray-500">Nieko nerasta.</div>
        )}
      </div>

      {/* Pagrindinis modalas: kliento info + istorija */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditMode(false);
          setSaveError("");
        }}
        title={selected ? selected.name : "Istorija"}
      >
        {!selected ? (
          <div className="text-gray-500">Pasirinkite klientą.</div>
        ) : (
          <div className="space-y-4">
            {/* Kliento informacija + redagavimas */}
            <div className="border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Kliento informacija</div>
                {!editMode ? (
                  <button
                    className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                    onClick={() => setEditMode(true)}
                  >
                    Redaguoti
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveClient}
                      disabled={saving}
                      className="text-sm px-3 py-1.5 rounded-lg bg-black text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {saving ? "Saugoma..." : "Išsaugoti"}
                    </button>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setForm({
                          name: selected.name || "",
                          phone: selected.phone || "",
                          email: selected.email || "",
                          gender: selected.gender || "",
                        });
                        setSaveError("");
                      }}
                      className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                    >
                      Atšaukti
                    </button>
                  </div>
                )}
              </div>

              {saveError && (
                <div className="text-sm text-red-600 mb-2">{saveError}</div>
              )}

              {!editMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">Vardas</div>
                    <div className="font-medium">{selected.name || "—"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Telefonas</div>
                    <div className="font-medium">{selected.phone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">El. paštas</div>
                    <div className="font-medium">{selected.email || "—"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Lytis</div>
                    <div className="font-medium">{selected.gender || "—"}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm">
                    <div className="text-gray-500 mb-1">Vardas</div>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm">
                    <div className="text-gray-500 mb-1">Telefonas</div>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm">
                    <div className="text-gray-500 mb-1">El. paštas</div>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </label>
                  <label className="text-sm">
                    <div className="text-gray-500 mb-1">Lytis</div>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={form.gender}
                      onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Istorijos lentelė */}
            <div className="-mx-2 overflow-auto">
              <table className="w-full text-sm">
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
                  {history.map((a) => (
                    <tr key={a.id} className="border-t align-top">
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
                      <td className="p-2">
                        {a.note ? (
                          <button
                            className="underline hover:no-underline text-left break-words"
                            onClick={() => {
                              setNoteItem(a);
                              setNoteModalOpen(true);
                            }}
                            title="Atidaryti pilnas pastabas"
                          >
                            {shorten(a.note, 100)}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td className="p-2 text-gray-500" colSpan={5}>
                        Šis klientas dar neturi įrašų.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Pilnos pastabos modalas */}
      <Modal
        open={noteModalOpen}
        onClose={() => {
          setNoteModalOpen(false);
          setNoteItem(null);
        }}
        title="Pastabos"
      >
        {!noteItem ? (
          <div className="text-gray-500 text-sm">Pastaba nepasirinkta.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <div>
                <span className="text-gray-500">Data:</span> {noteItem.date}
              </div>
              <div>
                <span className="text-gray-500">Laikas:</span>{" "}
                {noteItem.start_time?.slice(0, 5)}–{noteItem.end_time?.slice(0, 5)}
              </div>
              <div>
                <span className="text-gray-500">Paslauga:</span>{" "}
                {noteItem.services?.category}
                {noteItem.services?.name ? " • " + noteItem.services.name : ""}
              </div>
              {typeof noteItem.price !== "undefined" && (
                <div>
                  <span className="text-gray-500">Kaina:</span>{" "}
                  {noteItem.price ? `${noteItem.price} €` : "—"}
                </div>
              )}
            </div>
            <div className="border rounded-xl p-3 bg-gray-50">
              <div className="text-xs text-gray-500 mb-1">Pilnas tekstas</div>
              <div className="whitespace-pre-wrap break-words text-sm">
                {noteItem.note}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Clients;
