const ENDPOINT = "/predictions";
const USE_MOCK = false;

const MOCK_RESPONSE = {
  items: [
    {
      id: "h1",
      label: "Plástico",
      category: "Residuo Inorgánico",
      dateIso: "2025-12-23T14:05:00Z",
      thumbnail:
        "https://firebasestorage.googleapis.com/v0/b/cip-platform-574db.appspot.com/o/files_reciclaje%2Fimage-removebg-preview%20(12).png?alt=media&token=705a42e7-74b3-463d-9511-e5903fbac68c",
    },
    {
      id: "h2",
      label: "Vidrio",
      category: "Residuo Inorgánico",
      dateIso: "2025-12-22T10:30:00Z",
      thumbnail:
        "https://firebasestorage.googleapis.com/v0/b/cip-platform-574db.appspot.com/o/files_reciclaje%2Fimage-removebg-preview%20(10).png?alt=media&token=abc123",
    },
    {
      id: "h3",
      label: "Papel",
      category: "Residuo Reciclable",
      dateIso: "2025-12-21T09:10:00Z",
      thumbnail:
        "https://firebasestorage.googleapis.com/v0/b/cip-platform-574db.appspot.com/o/files_reciclaje%2Fimage-removebg-preview%20(8).png?alt=media&token=xyz456",
    },
  ],
  totalsByLabel: {},
  totalItemsInPage: 3,
  nextStartAfterIso: "2025-12-21T09:10:00Z",
};

/**
 * Obtiene el historial de predicciones desde el backend
 * Retorna el shape del backend:
 * { items, totalsByLabel, totalItemsInPage, nextStartAfterIso }
 */
export async function fetchHistory({ signal, limit = 20, startAfterIso } = {}) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 600));
    return MOCK_RESPONSE;
  }

  try {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (startAfterIso) params.set("start_after_iso", String(startAfterIso));

    const url = `${ENDPOINT}?${params.toString()}`;
    const res = await fetch(url, { signal });

    if (!res.ok) throw new Error(`GET ${url} ${res.status}`);
    const data = await res.json();

    // Esperado: data = { items, totalsByLabel, totalItemsInPage, nextStartAfterIso }
    const rawItems = Array.isArray(data?.items) ? data.items : [];

    // Normaliza items por si hay variaciones
    const items = rawItems.map((item) => ({
      id: item.id ?? item._id ?? safeUUID(),
      label: item.label ?? item.class ?? "Desconocido",
      category: item.category ?? "Sin categoría",
      dateIso: item.dateIso ?? item.created_at ?? new Date().toISOString(),
      thumbnail: item.thumbnail ?? item.image_url ?? item.image ?? "",
    }));

    return {
      items,
      totalsByLabel: data?.totalsByLabel ?? {},
      totalItemsInPage:
        typeof data?.totalItemsInPage === "number"
          ? data.totalItemsInPage
          : items.length,
      nextStartAfterIso: data?.nextStartAfterIso ?? null,
    };
  } catch (err) {
    // AbortError en dev (StrictMode) es normal: no uses MOCK ni hagas warning
    if (err?.name === "AbortError") throw err;

    console.warn("⚠️ Error obteniendo historial, usando MOCK:", err);
    return MOCK_RESPONSE;
  }
}

function safeUUID() {
  try {
    return crypto.randomUUID();
  } catch {
    return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}
