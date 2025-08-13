import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Modal from "../components/Modal";

function Clients({ workspace }) {
  const [search, setSearch] = useState("");
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);

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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={selected ? selected.name : "Istorija"}
      >
        {!selected ? (
          <div className="text-gray-500">Pasirinkite klientą.</div>
        ) : (
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
                {history.length === 0 && (
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
      </Modal>
    </div>
  );
}

export default Clients;
