import React, { useEffect, useMemo, useState } from "react";
import { fetchHistory } from "../api/history";

export default function HistoryView({ onSelect }) {
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState({});
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  // UI
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    const ctrl = new AbortController();
    setStatus("loading");

    fetchHistory({ signal: ctrl.signal })
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotals(data?.totalsByLabel ?? {});
        setCursor(data?.nextStartAfterIso ?? null);
      })
      .then(() => setStatus("ready"))
      .catch((e) => {
        if (e.name !== "AbortError") {
          console.error(e);
          setStatus("error");
        }
      });

    return () => ctrl.abort();
  }, []);

  const totalsEntries = useMemo(() => {
    const entries = Object.entries(totals || {});
    entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    return entries;
  }, [totals]);

  const categories = useMemo(() => {
    const set = new Set(items.map((it) => it.category).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const okCategory =
        categoryFilter === "all" ? true : it.category === categoryFilter;
      if (!okCategory) return false;
      if (!q) return true;

      const hay = `${it.label} ${it.category} ${it.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, categoryFilter]);

  const kpis = useMemo(() => {
    const pageCount = items.length;
    const uniqueLabels = new Set(items.map((it) => it.label)).size;
    const lastDate = items[0]?.dateIso ? formatDateTime(items[0].dateIso) : "—";
    return { pageCount, uniqueLabels, lastDate };
  }, [items]);

  return (
    <div className="history-screen">
      {status === "loading" && <div className="history-skeleton" />}

      {status === "error" && (
        <div className="history-empty">
          No se pudo cargar el historial. Verifica la conexión y el estado del
          servicio.
        </div>
      )}

      {status === "ready" && (
        <>
          {/* KPIs (nuevo) */}
          <div
            className="history-kpis"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: ".75rem",
              marginBottom: ".75rem",
            }}
          >
            <KpiCard title="Registros en esta página" value={kpis.pageCount} />
            <KpiCard title="Clases distintas (página)" value={kpis.uniqueLabels} />
            <KpiCard title="Última clasificación" value={kpis.lastDate} />
          </div>

          {/* Totales (mejorado) */}
          <div className="history-summary" style={{ marginBottom: ".9rem" }}>
            <div
              className="history-summary-title"
              style={{
                fontWeight: 800,
                color: "#14532d",
                marginBottom: ".25rem",
              }}
            >
              Totales clasificados (histórico)
            </div>

            <div
              className="history-summary-hint"
              style={{
                color: "#64748b",
                fontSize: ".85rem",
                marginBottom: ".5rem",
              }}
            >
              Conteo global por clase almacenado en Firestore.
            </div>

            {totalsEntries.length === 0 ? (
              <div className="history-summary-empty" style={{ color: "#64748b" }}>
                No hay totales disponibles.
              </div>
            ) : (
              <div
                className="history-chips"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: ".5rem",
                }}
              >
                {totalsEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="history-chip"
                    title={key}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: ".5rem",
                      padding: ".35rem .6rem",
                      borderRadius: "9999px",
                      border: "1px solid #bbf7d0",
                      background: "#f0fdf4",
                      color: "#14532d",
                      fontWeight: 700,
                      fontSize: ".85rem",
                    }}
                  >
                    <span className="history-chip-label">{prettyLabel(key)}</span>
                    <span
                      className="history-chip-value"
                      style={{
                        padding: ".05rem .5rem",
                        borderRadius: "9999px",
                        background: "#dcfce7",
                        border: "1px solid #86efac",
                        fontWeight: 800,
                      }}
                    >
                      {value ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {cursor && (
              <div
                className="history-summary-sub"
                style={{
                  marginTop: ".5rem",
                  color: "#64748b",
                  fontSize: ".8rem",
                }}
              >
                Cursor para paginación:{" "}
                <span className="mono" style={{ wordBreak: "break-all" }}>
                  {cursor}
                </span>
              </div>
            )}
          </div>

          {/* Controles (nuevo, sin depender de Tailwind) */}
          <div
            className="history-controls"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: ".6rem",
              marginBottom: ".9rem",
            }}
          >
            <label style={{ display: "grid", gap: ".25rem" }}>
              <span style={{ fontSize: ".85rem", fontWeight: 700, color: "#14532d" }}>
                Búsqueda
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por clase, categoría o ID"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: ".25rem" }}>
              <span style={{ fontSize: ".85rem", fontWeight: 700, color: "#14532d" }}>
                Categoría
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={inputStyle}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "Todas" : c}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategoryFilter("all");
              }}
              style={resetBtnStyle}
            >
              Restablecer filtros
            </button>
          </div>

          {/* Lista */}
          {items.length === 0 ? (
            <div className="history-empty">
              No hay registros. Cuando se realicen clasificaciones, aparecerán aquí.
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="history-empty">
              No hay resultados con los filtros actuales.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: ".6rem",
                }}
              >
                <div style={{ fontWeight: 800, color: "#14532d" }}>Registros</div>
                <div style={{ color: "#64748b", fontSize: ".85rem" }}>
                  {filteredItems.length} de {items.length}
                </div>
              </div>

              <ul className="history-list">
                {filteredItems.map((it) => (
                  <li
                    key={it.id}
                    className="history-item"
                    onClick={() => onSelect?.(it)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelect?.(it);
                    }}
                  >
                    <img
                      className="history-thumb"
                      src={it.thumbnail}
                      alt={it.label}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div className="history-meta">
                      <div className="history-title">{it.label}</div>
                      <div className="history-sub">{it.category}</div>
                      <div className="history-date">
                        Fecha: {formatDateTime(it.dateIso)}
                      </div>
                      <div
                        className="mono"
                        style={{
                          color: "#64748b",
                          fontSize: ".8rem",
                          wordBreak: "break-all",
                        }}
                        title={it.id}
                      >
                        ID: {shortId(it.id)}
                      </div>
                    </div>
                    <div className="history-chevron">›</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: ".75rem .9rem",
        boxShadow: "0 4px 14px rgba(0,0,0,.06)",
      }}
    >
      <div style={{ color: "#64748b", fontSize: ".85rem", fontWeight: 700 }}>
        {title}
      </div>
      <div style={{ marginTop: ".25rem", color: "#14532d", fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: ".7rem .85rem",
  background: "#fff",
  color: "#111827",
  outline: "none",
  boxShadow: "0 2px 8px rgba(0,0,0,.04)",
};

const resetBtnStyle = {
  width: "100%",
  borderRadius: 9999,
  border: "1px solid #bbf7d0",
  padding: ".75rem 1rem",
  background: "linear-gradient(to right, #f0fdf4, #d1fae5)",
  color: "#14532d",
  fontWeight: 800,
  cursor: "pointer",
};

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    const dd = `${d.getDate()}`.padStart(2, "0");
    const mm = `${d.getMonth() + 1}`.padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = `${d.getHours()}`.padStart(2, "0");
    const mi = `${d.getMinutes()}`.padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

function prettyLabel(key) {
  return String(key)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortId(id) {
  const s = String(id || "");
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
