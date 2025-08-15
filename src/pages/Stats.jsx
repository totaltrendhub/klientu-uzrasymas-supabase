// src/pages/Stats.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import lt from "date-fns/locale/lt";

/* ───────── Utils ───────── */
function diffMinutes(a, b) {
  if (!a || !b) return 0;
  const [ah, am] = a.slice(0, 5).split(":").map(Number);
  const [bh, bm] = b.slice(0, 5).split(":").map(Number);
  return Math.max(0, (bh * 60 + bm) - (ah * 60 + am));
}

function monthsOptions(n = 18) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: format(d, "yyyy-MM"), label: format(d, "LLLL yyyy", { locale: lt }) };
  });
}

const eur = new Intl.NumberFormat("lt-LT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/* ───────── Component ───────── */
export default function Stats({ workspace }) {
  const [services, setServices] = useState([]);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [err, setErr] = useState(null);

  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");

  // Navigacija mėnesiui
  const monthDate = parseISO(month + "-01");
  const prevMonthStr = format(subMonths(monthDate, 1), "yyyy-MM");
  const nextMonthStr = format(addMonths(monthDate, 1), "yyyy-MM");
  const isNextInFuture = addMonths(monthDate, 1) > new Date();

  /* ---- Duomenys: tik pasirinktas mėnuo ---- */
  useEffect(() => {
    async function loadMonth() {
      if (!workspace?.id) return;
      setErr(null);
      setLoadingItems(true);
      try {
        const d0 = parseISO(month + "-01");
        const dstart = startOfMonth(d0);
        const dend = endOfMonth(d0);
        const startStr = format(dstart, "yyyy-MM-dd");
        const endStr = format(dend, "yyyy-MM-dd");

        const [{ data: appts, error: apErr }, { data: svcs, error: svcErr }] =
          await Promise.all([
            supabase
              .from("appointments")
              .select("*, services(id,category,color,exclude_from_stats), clients(gender)")
              .eq("workspace_id", workspace.id)
              .gte("date", startStr)
              .lte("date", endStr)
              .order("date", { ascending: true })
              .order("start_time", { ascending: true }),
            supabase
              .from("services")
              .select("id,category,name,color,exclude_from_stats")
              .eq("workspace_id", workspace.id),
          ]);

        if (apErr) throw apErr;
        if (svcErr) throw svcErr;

        setItems(appts || []);
        setServices(svcs || []);
      } catch (e) {
        setErr(e.message || "Nepavyko įkelti duomenų.");
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    }
    loadMonth();
  }, [workspace?.id, month]);

  /* ---- Naudingi get'ai ---- */
  const apptCategory = (a) => a?.services?.category || a?.category || "";

  function isExcluded(appt) {
    if (appt?.services?.exclude_from_stats) return true;
    if ((!appt?.service_id || !appt?.services) && appt?.category) {
      const row = services.find(
        (s) =>
          s.category === appt.category &&
          (s.name == null || String(s.name).trim() === "")
      );
      if (row?.exclude_from_stats) return true;
    }
    return false;
  }

  /* ---- Filtruotas masyvas ---- */
  const baseMonth = useMemo(
    () => (items || []).filter((a) => !isExcluded(a)),
    [items, services]
  );

  let filtered = baseMonth;
  if (gender) filtered = filtered.filter((a) => (a.clients?.gender || "") === gender);
  if (category) filtered = filtered.filter((a) => apptCategory(a) === category);

  const filteredAttended = filtered.filter((a) => a.status === "attended");

  /* ---- KPI ---- */
  const visits = filteredAttended.length;
  const revenue = filteredAttended.reduce((s, a) => s + (Number(a.price) || 0), 0);
  const minutes = filteredAttended.reduce((s, a) => s + diffMinutes(a.start_time, a.end_time), 0);
  const uniqueClients = new Set(filteredAttended.map((a) => a.client_id)).size;

  const noShow = baseMonth.filter((a) => a.status === "no_show").length;
  const okPlusNoShow = baseMonth.filter((a) => ["attended", "no_show"].includes(a.status)).length;
  const noShowPct = okPlusNoShow ? (noShow * 100) / okPlusNoShow : 0;

  /* ---- Grafikas: per dieną ---- */
  const d0 = parseISO(month + "-01");
  const dstart = startOfMonth(d0);
  const dend = endOfMonth(d0);
  const days = eachDayOfInterval({ start: dstart, end: dend });

  const perDay = useMemo(() => {
    const map = new Map(days.map((d) => [format(d, "yyyy-MM-dd"), 0]));
    filteredAttended.forEach((a) => {
      const k = a.date;
      map.set(k, (map.get(k) || 0) + (Number(a.price) || 0));
    });
    return Array.from(map.entries()).map(([date, sum]) => ({ date, sum }));
  }, [filteredAttended, month]);

  const maxY = Math.max(1, ...perDay.map((x) => x.sum));
  const xWidth = Math.max(640, days.length * 22);
  const chartW = xWidth;
  const chartH = 240;
  const yBase = chartH - 40; // bottom axis y
  const x0 = 40;             // left padding
  const xEnd = chartW - 20;  // right padding
  const yScale = (val) => {
    const plotH = yBase - 20;
    return yBase - (val / maxY) * plotH;
  };

  /* ---- Tooltip (hover/tap ant stulpelio) ---- */
  const chartRef = useRef(null);
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, data: null });

  function computeDayStats(dateStr) {
    const dayAtt = filtered.filter((a) => a.date === dateStr && a.status === "attended");
    const dayNoShow = filtered.filter((a) => a.date === dateStr && a.status === "no_show").length;
    const dayRev = dayAtt.reduce((s, a) => s + (Number(a.price) || 0), 0);
    const dayMin = dayAtt.reduce((s, a) => s + diffMinutes(a.start_time, a.end_time), 0);
    return { dateStr, visits: dayAtt.length, revenue: dayRev, minutes: dayMin, noShow: dayNoShow };
  }

  function showTipForIndex(i, evt) {
    const d = perDay[i];
    if (!d || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const clientX = (evt?.touches ? evt.touches[0].clientX : evt?.clientX) ?? rect.left;
    const clientY = (evt?.touches ? evt.touches[0].clientY : evt?.clientY) ?? rect.top;
    const left = (clientX - rect.left) + chartRef.current.scrollLeft + 6;
    const top = (clientY - rect.top) - 36;
    setTip({ show: true, x: left, y: Math.max(0, top), data: computeDayStats(d.date) });
  }

  function hideTip() {
    setTip((t) => ({ ...t, show: false }));
  }

  /* ---- Kategorijos agregatai (apačios lentelė) ---- */
  const apptCategoryMemo = apptCategory;
  const categoryAgg = useMemo(() => {
    const agg = new Map();
    let total = 0;
    filteredAttended.forEach((a) => {
      const cat = apptCategoryMemo(a);
      const sum = Number(a.price) || 0;
      total += sum;
      const prev = agg.get(cat) || { cat, revenue: 0, cnt: 0 };
      agg.set(cat, { cat, revenue: prev.revenue + sum, cnt: prev.cnt + 1 });
    });
    const arr = Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue);
    return { arr, total };
  }, [filteredAttended]);

  const topCats = categoryAgg.arr.slice(0, 6);

  /* ---- Filtrų pasirinkimai ---- */
  const categoryOptions = useMemo(
    () => Array.from(new Set(services.map((s) => s.category))).filter(Boolean),
    [services]
  );

  function clearFilters() {
    setGender("");
    setCategory("");
  }

  /* ---- UI ---- */
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filtrų blokas */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="text-base sm:text-lg font-semibold">Statistika</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              onClick={() => setMonth(prevMonthStr)}
              aria-label="Ankstesnis mėnuo"
            >
              ◀
            </button>
            <div className="min-w-[160px] text-center font-medium capitalize">
              {format(monthDate, "LLLL yyyy", { locale: lt })}
            </div>
            <button
              className="px-3 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setMonth(nextMonthStr)}
              disabled={isNextInFuture}
              aria-label="Kitas mėnuo"
            >
              ▶
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <div className="text-xs text-gray-500 mb-1">Mėnuo</div>
            <select
              className="px-3 py-2 rounded-xl border w-full"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {monthsOptions(18).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Kategorija</div>
            <select
              className="px-3 py-2 rounded-xl border w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Visos</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Lytis</div>
            <select
              className="px-3 py-2 rounded-xl border w-full"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="">Visi</option>
              <option value="female">Moteris</option>
              <option value="male">Vyras</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="px-3 py-2 rounded-xl border w-full sm:w-auto" onClick={clearFilters}>
              Išvalyti filtrus
            </button>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-2xl shadow">
          <div className="text-sm text-gray-600">Vizitų</div>
          <div className="text-2xl font-bold">{visits}</div>
        </div>
        <div className="p-4 bg-white rounded-2xl shadow">
          <div className="text-sm text-gray-600">Uždarbis</div>
          <div className="text-2xl font-bold">{eur.format(revenue)}</div>
        </div>
        <div className="p-4 bg-white rounded-2xl shadow">
          <div className="text-sm text-gray-600">Dirbta</div>
          <div className="text-2xl font-bold">
            {Math.floor(minutes / 60)} h {minutes % 60} min
          </div>
        </div>
        <div className="p-4 bg-white rounded-2xl shadow">
          <div className="text-sm text-gray-600">Neatvyko</div>
          <div className="text-2xl font-bold">{noShow} ({noShowPct.toFixed(0)}%)</div>
        </div>
        <div className="p-4 bg-white rounded-2xl shadow">
          <div className="text-sm text-gray-600">Unikalių klientų</div>
          <div className="text-2xl font-bold">{uniqueClients}</div>
        </div>
      </div>

      {/* Grafikas (stulpeliai) su interaktyviu tooltip */}
      <div
        className="bg-white rounded-2xl shadow p-5 overflow-x-auto relative"
        ref={chartRef}
        onClick={hideTip}
        style={{ touchAction: "pan-x pan-y" }}   // <-- leidžiam normaliai slinkti telefone
      >
        <div className="font-semibold mb-2">
          Pajamos – {format(d0, "LLLL yyyy", { locale: lt })}
        </div>

        {loadingItems ? (
          <div className="text-gray-500">Įkeliama...</div>
        ) : err ? (
          <div className="text-rose-600">{err}</div>
        ) : (
          <svg
            width={Math.max(640, days.length * 22)}
            height={240}
            role="img"
            aria-label="Pajamų grafikas"
            style={{ touchAction: "pan-x pan-y" }}   // <-- neužblokuoja vertikalaus scroll
          >
            {/* Ašys */}
            <line x1={40} y1={20} x2={40} y2={200} stroke="currentColor" opacity="0.4" />
            <line x1={40} y1={200} x2={Math.max(620, days.length * 22)} y2={200} stroke="currentColor" opacity="0.4" />

            {/* Y tinklas + žymos */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
              const val = maxY * f;
              const y = 200 - (val / maxY) * 180;
              return (
                <g key={i}>
                  <line x1={40} y1={y} x2={Math.max(620, days.length * 22)} y2={y} stroke="currentColor" opacity="0.08" />
                  <text x={6} y={y + 4} fontSize="10">{Math.round(val)} €</text>
                </g>
              );
            })}

            {/* Stulpeliai (dienos) */}
            {perDay.map((d, i) => {
              const step = (Math.max(620, days.length * 22) - 40) / Math.max(1, perDay.length - 1);
              const x = 40 + i * step - 6;
              const h = (d.sum / maxY) * 180;
              const y = 200 - h;
              const dayNum = parseInt(d.date.slice(-2), 10);
              return (
                <g key={d.date}>
                  <rect
                    x={x}
                    y={y}
                    width="12"
                    height={h}
                    className="fill-emerald-600 cursor-pointer"
                    onMouseEnter={(e) => showTipForIndex(i, e)}
                    onMouseMove={(e) => showTipForIndex(i, e)}
                    onMouseLeave={hideTip}
                    onClick={(e) => { e.stopPropagation(); showTipForIndex(i, e); }}
                  >
                    <title>{`${d.date}: ${eur.format(d.sum)}`}</title>
                  </rect>
                  <text x={x + 6} y={214} fontSize="9" textAnchor="middle">
                    {dayNum}
                  </text>
                </g>
              );
            })}

            <text x={6} y={12} fontSize="10">€ per dieną</text>
          </svg>
        )}

        {/* Tooltip */}
        {tip.show && tip.data && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white text-xs px-2 py-1 rounded-md shadow"
            style={{ left: tip.x, top: tip.y, transform: "translate(-50%,-100%)" }}
          >
            <div className="font-medium">
              {format(parseISO(tip.data.dateStr), "yyyy-MM-dd")}
            </div>
            <div>Vizitų: <span className="font-semibold">{tip.data.visits}</span></div>
            <div>Uždarbis: <span className="font-semibold">{eur.format(tip.data.revenue)}</span></div>
            <div>
              Dirbta:{" "}
              <span className="font-semibold">
                {Math.floor(tip.data.minutes / 60)} h {tip.data.minutes % 60} min
              </span>
            </div>
            <div>Neatvyko: <span className="font-semibold">{tip.data.noShow}</span></div>
          </div>
        )}
      </div>

      {/* Top kategorijos */}
      <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Top kategorijos</div>
          <div className="text-xs text-gray-500">Filtrai taikomi šiam sąrašui</div>
        </div>

        {loadingItems ? (
          <div className="text-gray-500">Įkeliama...</div>
        ) : topCats.length === 0 ? (
          <div className="text-gray-500">Nėra duomenų.</div>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="p-2">Kategorija</th>
                  <th className="p-2">Vizitų</th>
                  <th className="p-2">Pajamos</th>
                  <th className="p-2">Dalis</th>
                </tr>
              </thead>
              <tbody>
                {topCats.map((row) => {
                  const col =
                    services.find(
                      (s) =>
                        s.category === row.cat &&
                        (s.name == null || String(s.name).trim() === "")
                    )?.color || "#e5e7eb";
                  const pct = categoryAgg.total ? (row.revenue * 100) / categoryAgg.total : 0;
                  return (
                    <tr key={row.cat} className="border-t">
                      <td className="p-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                          style={{ backgroundColor: col }}
                          title={col || "numatyta (pilka)"}
                        />
                        {row.cat || "—"}
                      </td>
                      <td className="p-2">{row.cnt}</td>
                      <td className="p-2">{eur.format(row.revenue)}</td>
                      <td className="p-2">{pct.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
