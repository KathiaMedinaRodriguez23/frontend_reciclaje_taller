import React, { useEffect, useState } from 'react';
import { fetchHistory } from '../api/history';

export default function HistoryView({ onSelect }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    const ctrl = new AbortController();
    setStatus('loading');
    fetchHistory({ signal: ctrl.signal })
      .then(setItems)
      .then(() => setStatus('ready'))
      .catch((e) => {
        if (e.name !== 'AbortError') {
          console.error(e);
          setStatus('error');
        }
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="history-screen">
      {status === 'loading' && <div className="history-skeleton" />}

      {status === 'error' && (
        <div className="history-empty">No se pudo cargar el historial.</div>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="history-empty">Sin registros aún.</div>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="history-list">
          {items.map((it) => (
            <li
              key={it.id}
              className="history-item"
              onClick={() => onSelect?.(it)}
              role="button"
              tabIndex={0}
            >
              <img className="history-thumb" src={it.thumbnail} alt={it.label} />
              <div className="history-meta">
                <div className="history-title">{it.label}</div>
                <div className="history-sub">{it.category}</div>
                <div className="history-date">Fecha: {formatDate(it.dateIso)}</div>
              </div>
              <div className="history-chevron">›</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const dd = `${d.getDate()}`.padStart(2, '0');
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd} - ${mm} - ${yyyy}`;
  } catch {
    return iso;
  }
}
