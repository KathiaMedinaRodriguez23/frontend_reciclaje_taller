const ENDPOINT = '/predictions'; // <-- tu endpoint real
const USE_MOCK = false; // cambia a true si quieres simular sin backend

const MOCK_DATA = [
  {
    id: 'h1',
    label: 'Plástico',
    category: 'Residuo Inorgánico',
    dateIso: '2025-12-23T14:05:00Z',
    thumbnail:
      'https://firebasestorage.googleapis.com/v0/b/cip-platform-574db.appspot.com/o/files_reciclaje%2Fimage-removebg-preview%20(12).png?alt=media&token=705a42e7-74b3-463d-9511-e5903fbac68c'
  },
  {
    id: 'h2',
    label: 'Vidrio',
    category: 'Residuo Inorgánico',
    dateIso: '2025-12-22T10:30:00Z',
    thumbnail:
      'https://firebasestorage.googleapis.com/v0/b/cip-platform-574db.appspot.com/o/files_reciclaje%2Fimage-removebg-preview%20(10).png?alt=media&token=abc123'
  },
  {
    id: 'h3',
    label: 'Papel',
    category: 'Residuo Reciclable',
    dateIso: '2025-12-21T09:10:00Z',
    thumbnail:
      'https://firebasestorage.googleapis.com/v0/b/cip-platform-574db.appspot.com/o/files_reciclaje%2Fimage-removebg-preview%20(8).png?alt=media&token=xyz456'
  }
];

/**
 * Obtiene el historial de predicciones desde el backend
 * @param {Object} opts - opciones
 * @param {AbortSignal} [opts.signal] - signal opcional para cancelar fetch
 * @returns {Promise<Array<{id,label,category,dateIso,thumbnail}>>}
 */
export async function fetchHistory({ signal } = {}) {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 600));
    return MOCK_DATA;
  }

  try {
    const res = await fetch(ENDPOINT, { signal });
    if (!res.ok) throw new Error(`GET ${ENDPOINT} ${res.status}`);
    const data = await res.json();

    // Normaliza si el backend devuelve otros nombres de campos
    return data.map(item => ({
      id: item.id ?? item._id ?? crypto.randomUUID(),
      label: item.label ?? item.class ?? 'Desconocido',
      category: item.category ?? 'Sin categoría',
      dateIso: item.dateIso ?? item.created_at ?? new Date().toISOString(),
      thumbnail: item.thumbnail ?? item.image_url ?? item.image ?? ''
    }));
  } catch (err) {
    console.warn('⚠️ Error obteniendo historial, usando MOCK:', err);
    return MOCK_DATA;
  }
}
