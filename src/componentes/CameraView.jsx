import React, {
  useEffect, useRef, useState, useMemo,
  forwardRef, useImperativeHandle, useCallback
} from 'react';
import { ArrowLeft, Camera as CameraIcon, Image as ImageIcon, Flashlight, FlashlightOff } from 'lucide-react';

const BACKEND_URL = '/predict'; // <-- tu endpoint real
const REQ_TIMEOUT_MS = 20000; // 20s

const CameraView = forwardRef(function CameraView(
  { onClose, onPrediction, onCapture, onPickImage },
  ref
) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const inputFileRef = useRef(null);
  const mountedRef = useRef(false);
  const startNonce = useRef(0);

  const [error, setError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchCapable, setTorchCapable] = useState(false);
  const [mode, setMode] = useState('live');     // 'live' | 'loading' | 'result'
  const [result, setResult] = useState(null);   // { label, probs, snapshotUrl }

  // --- cierre agresivo (libera la cámara en todos los navegadores) ---
  const stopCamera = useCallback(() => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
        streamRef.current = null;
      }
      if (trackRef.current) {
        try { trackRef.current.stop(); } catch {}
        trackRef.current = null;
      }
      const v = videoRef.current;
      if (v) {
        try { v.pause(); } catch {}
        try { v.srcObject = null; } catch {}
        try { v.removeAttribute('srcObject'); } catch {}
        try { v.removeAttribute('src'); } catch {}
        try { v.src = ''; } catch {}
        try { v.load(); } catch {}
      }
      setTorchOn(false);
    } catch {}
  }, []);

  useImperativeHandle(ref, () => ({ stop: stopCamera }), [stopCamera]);

  // --- arranque cámara ---
  const startCamera = useCallback(async () => {
    // Cancela carreras entre invocaciones (StrictMode monta/desmonta dos veces)
    const myNonce = ++startNonce.current;

    try {
      // Limpia lo que haya
      stopCamera();

      // Pide permisos
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      // Si durante el await se desmontó o se lanzó otro start, aborta y suelta
      if (!mountedRef.current || myNonce !== startNonce.current) {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        return;
      }

      // Asegura que el <video> existe; si no, libera y sal
      const v = videoRef.current;
      if (!v) {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        return;
      }

      // Guarda refs y capacidades
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      const caps = track.getCapabilities?.();
      if (caps && 'torch' in caps) setTorchCapable(true);

      // Asigna stream al <video>
      v.srcObject = stream;

      // Espera metadatos/medidas del video
      await new Promise((res) => {
        if (v.readyState >= 1) res();
        else v.addEventListener('loadedmetadata', res, { once: true });
      });

      // Revisa nuevamente (puede haberse desmontado/reenfocado)
      if (!mountedRef.current || myNonce !== startNonce.current || !videoRef.current) {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        return;
      }

      try { await v.play(); }
      catch {
        await new Promise((res) => {
          const ok = () => res();
          v.addEventListener('playing', ok, { once: true });
          v.addEventListener('canplay', ok, { once: true });
        });
        try { await v.play(); } catch {}
      }
    } catch (e) {
      console.error(e);
      if (mountedRef.current) setError('No se pudo acceder a la cámara. Revisa permisos/HTTPS.');
    }
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    startCamera();

    const onVis = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) { try { v.pause(); } catch {} }
      else if (mode === 'live') { try { v.play(); } catch {} }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVis);
      stopCamera(); // cleanup al desmontar
    };
  }, [startCamera, mode, stopCamera]);

  // --- util: request con timeout ---
  async function fetchWithTimeout(url, options = {}, timeoutMs = REQ_TIMEOUT_MS) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  // --- mapeo flexible de la respuesta del backend ---
  function normalizePrediction(json) {
    // acepta label/predicted/class; probs/probabilities/scores
    const label = json.label ?? json.predicted ?? json.class ?? 'desconocido';
    const rawProbs = json.probs ?? json.probabilities ?? json.scores ?? {};
    // Si viene un array tipo [{label, prob}], lo normalizamos
    let probsObj = rawProbs;
    if (Array.isArray(rawProbs)) {
      probsObj = {};
      for (const item of rawProbs) {
        if (item && item.label != null && item.prob != null) {
          probsObj[item.label] = Number(item.prob);
        }
      }
    }
    const sorted = Object.entries(probsObj)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([k, v]) => [k, Number(v)]);
    return { label, probs: Object.fromEntries(sorted) };
  }

  // --- acciones ---
  const toggleTorch = async () => {
    try {
      const track = trackRef.current;
      if (!track || !track.applyConstraints || !torchCapable) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (e) { console.warn('Torch no soportado/restringido:', e); }
  };

  const handleCapture = async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;

    setMode('loading');

    // snapshot
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, w, h);

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCapture && onCapture(blob, dataUrl);

    try {
      const form = new FormData();
      form.append('file', blob, 'capture.jpg');
      form.append('image', blob, 'capture.jpg');

      const resp = await fetchWithTimeout(BACKEND_URL, { method: 'POST', body: form });
      if (!resp.ok) throw new Error(`Backend ${resp.status}`);
      const json = await resp.json();

      const { label, probs } = normalizePrediction(json);
      const payload = { label, probs, snapshotUrl: dataUrl };
      onPrediction && onPrediction(payload);

      if (mountedRef.current) {
        setResult(payload);
        setMode('result');
        stopCamera(); // apaga cámara en resultado
      }
    } catch (err) {
      console.error(err);
      if (mountedRef.current) {
        setError(err?.name === 'AbortError' ? 'Tiempo de espera agotado.' : 'Error enviando la captura.');
        setMode('live');
      }
    }
  };

  const openGallery = () => inputFileRef.current?.click();

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      onPickImage && onPickImage(file, dataUrl);

      setMode('loading');
      try {
        const form = new FormData();
        form.append('file', file, file.name || 'gallery.jpg');
        form.append('image', file, file.name || 'gallery.jpg'); // opcional

        const resp = await fetchWithTimeout(BACKEND_URL, { method: 'POST', body: form });
        if (!resp.ok) throw new Error(`Backend ${resp.status}`);
        const json = await resp.json();

        const { label, probs } = normalizePrediction(json);
        if (mountedRef.current) {
          setResult({ label, probs, snapshotUrl: dataUrl });
          setMode('result');
          stopCamera();
        }
      } catch (err) {
        console.error(err);
        if (mountedRef.current) {
          setError(err?.name === 'AbortError' ? 'Tiempo de espera agotado.' : 'Error analizando imagen de galería.');
          setMode('live');
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const backToLive = async () => {
    setResult(null);
    setError('');
    setMode('live');
    await startCamera();
  };

  const probsSorted = useMemo(() => result?.probs ? Object.entries(result.probs) : [], [result]);

  return (
    <div className="camera-screen">
      <div className="camera-topbar">
        <button className="icon-btn ghost"
                onClick={() => { stopCamera(); onClose && onClose(); }}
                aria-label="Atrás">
          <ArrowLeft size={20} />
        </button>
        <h2 className="detecting-title">
          {mode === 'result' ? 'RESULTADO' : mode === 'loading' ? 'ENVIANDO…' : 'IDENTIFICADOR'}
        </h2>
      </div>

      {(mode === 'live' || mode === 'loading') && (
        <>
          <div className="camera-frame">
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
            <div className="camera-box" aria-hidden />
            {mode === 'loading' && <div className="loading-pill">cargando …</div>}
          </div>

          <div className="camera-bottom">
            <button className="icon-btn" onClick={toggleTorch} disabled={!torchCapable}
                    aria-label={torchOn ? 'Apagar flash' : 'Encender flash'}>
              {torchOn ? <FlashlightOff /> : <Flashlight />}
            </button>

            <button className="capture-btn" onClick={handleCapture} aria-label="Tomar foto" title="Tomar foto">
              <CameraIcon />
            </button>

            <button className="icon-btn" onClick={openGallery} aria-label="Abrir galería" title="Abrir galería">
              <ImageIcon />
            </button>

            <input ref={inputFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFilePicked}/>
          </div>
        </>
      )}

      {mode === 'result' && result && (
        <div className="result-wrapper">
          <div className="result-card image">
            <img src={result.snapshotUrl} alt="captura" className="result-img" />
            <div className="result-title">
              <div className="result-main">{capitalize(result.label)}</div>
              <div className="result-sub">Residuo Inorgánico</div>
            </div>
          </div>

          <div className="result-row">
            <div className="result-card">
              <div className="card-title">Residuo detectado</div>
              <div className="card-body mono">
                {probsSorted[0]?.[0] ?? '—'}: {(((probsSorted[0]?.[1]) ?? 0) * 100).toFixed(0)}%
              </div>
            </div>

            <div className="result-card">
              <div className="card-title">Probabilidades (ordenadas)</div>
              <div className="card-body mono">
                {probsSorted.map(([k, v]) => <div key={k}>{k}: {(v * 100).toFixed(2)}%</div>)}
              </div>
            </div>
          </div>

          <div className="result-actions">
            <button className="secondary-btn" onClick={backToLive}>Volver a detectar</button>
            <button className="primary-btn" onClick={() => { stopCamera(); onClose && onClose(); }}>Terminar</button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {error && <div className="camera-error">{error}</div>}
    </div>
  );
});

export default CameraView;

// Util
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
