import React, { useCallback, useEffect, useState } from 'react';
import Layout from './components/Layout';
import { NotificationToast } from './components/NotificationCenter';
import { useSignalR } from './hooks/useSignalR';
import CamerasPage from './pages/CamerasPage';
import DashboardPage from './pages/DashboardPage';
import FaceIdentifyPage from './pages/FaceIdentifyPage';
import FaceRecognitionPage from './pages/FaceRecognitionPage';
import FallAlertPage from './pages/FallAlertPage';
import PatientsPage from './pages/PatientsPage';
import SettingsPage from './pages/SettingsPage';
import { alertApi, dashboardApi } from './services/api';
import { FallAlert, PageType } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [toastAlerts, setToastAlerts] = useState<FallAlert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Handle new fall alert from SignalR
  const handleNewFallAlert = useCallback((alert: FallAlert) => {
    console.log('New fall alert received:', alert);
    setToastAlerts((prev) => [alert, ...prev].slice(0, 5));
    setActiveAlerts((prev) => prev + 1);

    // Play alert sound
    if (soundEnabled) {
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.5;
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 300);
      } catch (e) {
        console.log('Audio not available');
      }
    }
  }, [soundEnabled]);

  // Connect to SignalR
  const { isConnected: signalRConnected, acknowledgeAlert } = useSignalR({
    autoConnect: true,
    onFallAlert: handleNewFallAlert,
  });

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await dashboardApi.getStatus();
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    };

    const fetchAlerts = async () => {
      try {
        const alerts = await alertApi.getActiveAlerts();
        setActiveAlerts(alerts.length);
      } catch {
        setActiveAlerts(0);
      }
    };

    checkConnection();
    fetchAlerts();
    const interval = setInterval(() => {
      checkConnection();
      fetchAlerts();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigateToAlerts = () => {
    setCurrentPage('fall-alert');
  };

  const handleDismissToast = (alertId: number) => {
    setToastAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleAcknowledgeToast = async (alert: FallAlert) => {
    try {
      await alertApi.acknowledgeAlert(alert.id, 'System User');
      await acknowledgeAlert(alert.id, 'System User');
      setToastAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      setActiveAlerts((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigateToAlerts={handleNavigateToAlerts} />;
      case 'patients':
        return <PatientsPage />;
      case 'fall-alert':
        return <FallAlertPage />;
      case 'face-recognition':
        return <FaceRecognitionPage />;
      case 'face-identify':
        return <FaceIdentifyPage />;
      case 'cameras':
        return <CamerasPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigateToAlerts={handleNavigateToAlerts} />;
    }
  };

  return (
    <>
      <Layout 
        currentPage={currentPage} 
        onPageChange={setCurrentPage}
        isConnected={isConnected && signalRConnected}
        activeAlerts={activeAlerts}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
      >
        {renderPage()}
      </Layout>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {toastAlerts.map((alert) => (
          <NotificationToast
            key={alert.id}
            alert={alert}
            onClose={() => handleDismissToast(alert.id)}
            onAcknowledge={() => handleAcknowledgeToast(alert)}
          />
        ))}
      </div>
    </>
  );
};

export default App;
