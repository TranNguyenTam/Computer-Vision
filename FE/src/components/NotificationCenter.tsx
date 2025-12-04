import { AlertTriangle, Bell, CheckCircle, Volume2, VolumeX, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { FallAlert } from '../types';

interface NotificationToastProps {
  alert: FallAlert;
  onClose: () => void;
  onAcknowledge: () => void;
  autoCloseDelay?: number;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  alert,
  onClose,
  onAcknowledge,
  autoCloseDelay = 30000,
}) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onClose, 300);
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [autoCloseDelay, onClose]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`transform transition-all duration-300 ${
        isClosing ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
    >
      <div className="bg-red-600 text-white rounded-lg shadow-2xl p-4 max-w-sm border-l-4 border-red-800">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-lg">⚠️ CẢNH BÁO TÉ NGÃ!</h4>
            <p className="text-red-100 text-sm mt-1">
              {alert.location || 'Vị trí không xác định'}
            </p>
            {alert.patientName && (
              <p className="text-red-100 text-sm">
                Bệnh nhân: {alert.patientName}
              </p>
            )}
            <p className="text-red-200 text-xs mt-1">
              Độ tin cậy: {Math.round(alert.confidence * 100)}%
            </p>
            <p className="text-red-200 text-xs">
              {new Date(alert.timestamp).toLocaleString('vi-VN')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 hover:bg-red-500 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onAcknowledge}
            className="flex-1 px-3 py-2 bg-white text-red-600 rounded font-medium text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

interface NotificationCenterProps {
  alerts: FallAlert[];
  onAcknowledge: (alertId: number) => void;
  onDismiss: (alertId: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  alerts,
  onAcknowledge,
  onDismiss,
  soundEnabled,
  onToggleSound,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeAlerts = alerts.filter((a) => a.status === 'Active');

  // Play sound for new alerts
  useEffect(() => {
    if (soundEnabled && activeAlerts.length > 0) {
      // Create audio context for alert sound
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 200);
      } catch (e) {
        console.log('Audio not available');
      }
    }
  }, [activeAlerts.length, soundEnabled]);

  return (
    <div className="relative">
      {/* Notification Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {activeAlerts.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
            {activeAlerts.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Thông báo</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleSound}
                  className={`p-1.5 rounded-lg transition-colors ${
                    soundEnabled
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
                <span className="text-sm text-gray-500">
                  {activeAlerts.length} đang hoạt động
                </span>
              </div>
            </div>

            {/* Alert List */}
            <div className="max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Không có thông báo mới</p>
                </div>
              ) : (
                alerts.slice(0, 10).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      alert.status === 'Active' ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          alert.status === 'Active'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          Cảnh báo té ngã
                        </p>
                        <p className="text-gray-600 text-xs mt-0.5">
                          {alert.location || 'Vị trí không xác định'}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          {new Date(alert.timestamp).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      {alert.status === 'Active' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => onAcknowledge(alert.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Xác nhận"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDismiss(alert.id)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                            title="Bỏ qua"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {alerts.length > 10 && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                <button className="text-sm text-blue-600 hover:text-blue-700">
                  Xem tất cả ({alerts.length})
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
