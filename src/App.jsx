import React, {useEffect, useRef, useState} from 'react';
import { Home as HomeIcon, Camera, FileText } from 'lucide-react';
import CameraView from "./componentes/CameraView.jsx";
import HistoryView from "./componentes/HistoryView.jsx";
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const cameraRef = useRef(null);

  // Navegación con apagado de cámara previo
  const go = (tab) => {
    if (activeTab === 'camera' && tab !== 'camera') {
      console.log('🎥 Intentando detener cámara...');
      console.log('📍 cameraRef.current:', cameraRef.current);

      if (cameraRef.current?.stop) {
        try {
          cameraRef.current.stop();
          console.log('✅ Cámara detenida exitosamente');
        } catch (e) {
          console.warn("❌ Error deteniendo cámara:", e);
        }
      } else {
        console.warn('⚠️ cameraRef.current.stop no está disponible');
      }

      setTimeout(() => {
        console.log('🔄 Cambiando a tab:', tab);
        setActiveTab(tab);
      }, 150);
    } else {
      setActiveTab(tab);
    }
  };

  // Cleanup de seguridad cuando el componente se desmonta
  useEffect(() => {
    return () => {
      try { cameraRef.current?.stop?.(); } catch {}
    };
  }, []);

  return (
    <div className="app-container">
      <div className="app-wrapper">
        <header className="header">
          <h1 className="header-title">
            {activeTab === 'home' ? 'Home' : activeTab === 'camera' ? 'Cámara' : 'HISTORIAL'}
          </h1>
        </header>

        <main className="main-content">
          {activeTab === 'home' && (
            <>
              <div className="illustration-container">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/cip-platform-574db.appspot.com/o/files_reciclaje%2Fimage-removebg-preview%20(12).png?alt=media&token=705a42e7-74b3-463d-9511-e5903fbac68c"
                  alt="Residuos reciclables"
                  className="waste-illustration"
                />
              </div>
              <h2 className="main-title">IDENTIFICADOR DE RESIDUOS</h2>
              <p className="main-subtitle">Presione el botón para identificar el residuo</p>
              <button className="main-button" onClick={() => go('camera')}>
                <Camera className="button-icon" />
                IDENTIFICADOR DE RESIDUOS
              </button>
            </>
          )}

          {activeTab === 'camera' && (
            <CameraView
              ref={cameraRef}
              onClose={() => go('home')}
              onPrediction={(p) => console.log('Pred:', p)}
              onCapture={() => {}}
              onPickImage={() => {}}
            />
          )}

          {activeTab === 'documents' && (
            <HistoryView onSelect={(item) => console.log('Detalle:', item)} />
          )}
        </main>

        <nav className="bottom-nav">
          <button onClick={() => go('home')}
                  className={`nav-button ${activeTab === 'home' ? 'active' : ''}`} aria-label="Inicio">
            <div className="nav-icon-wrapper"><HomeIcon className="nav-icon" /></div>
          </button>

          <button onClick={() => go('camera')}
                  className={`nav-button nav-button-camera ${activeTab === 'camera' ? 'active' : ''}`} aria-label="Cámara">
            <div className="nav-icon-wrapper"><Camera className="nav-icon" /></div>
          </button>

          <button onClick={() => go('documents')}
                  className={`nav-button ${activeTab === 'documents' ? 'active' : ''}`} aria-label="Historial">
            <div className="nav-icon-wrapper"><FileText className="nav-icon" /></div>
          </button>
        </nav>
      </div>
    </div>
  );
}
