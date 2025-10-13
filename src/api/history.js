const ENDPOINT = '/api/history';
const USE_MOCK = true;

const MOCK_DATA = [
  {
    id: 'h1',
    label: 'Plastico',
    category: 'Residuo Inorgánico',
    dateIso: '2025-12-23T14:05:00Z',
    thumbnail:
      'https://firebasestorage.googleapis.com/v0/b/cip-platform-574db.appspot.com/o/files_reciclaje%2Fimage-removebg-preview%20(12).png?alt=media&token=705a42e7-74b3-463d-9511-e5903fbac68c'
  }
];

export async function fetchHistory({ signal } = {}) {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 600));
    return MOCK_DATA;
  }

  const r = await fetch(ENDPOINT, { signal });
  if (!r.ok) throw new Error(`GET ${ENDPOINT} ${r.status}`);
  const data = await r.json();
  // Normaliza si tu backend devuelve otro formato
  return data;
}
