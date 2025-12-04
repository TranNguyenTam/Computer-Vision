import {
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    Clock,
    MapPin,
    RefreshCw,
    User,
    Volume2,
    VolumeX,
    XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { alertApi } from '../services/api';
import { FallAlert } from '../types';

const FallDetectionPage: React.FC = () => {
  const [activeAlerts, setActiveAlerts] = useState<FallAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const playAlertSound = useCallback(() => {
    if (soundEnabled) {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), 200);
    }
  }, [soundEnabled]);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await alertApi.getActiveAlerts();
      setActiveAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    
    // SignalR realtime updates
    import('../services/signalr').then(({ default: signalRService }) => {
      signalRService.connect().then(() => {
        console.log('SignalR connected for Fall Detection');
        
        // Listen for new fall alerts
        signalRService.onFallAlert((alert) => {
          console.log('New fall alert received:', alert);
          setActiveAlerts((prev) => {
            // Avoid duplicates
            if (prev.some(a => a.id === alert.id)) return prev;
            return [alert, ...prev];
          });
          playAlertSound();
        });
        
        // Listen for status updates
        signalRService.onAlertStatusUpdate((data) => {
          setActiveAlerts((prev) =>
            prev.map((alert) =>
              alert.id === data.alertId ? { ...alert, status: data.status as FallAlert['status'] } : alert
            ).filter(a => a.status !== 'Resolved' && a.status !== 'FalsePositive')
          );
        });
      }).catch(err => {
        console.error('SignalR connection failed:', err);
      });
    });
    
    // Fallback polling every 10 seconds
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [fetchAlerts, playAlertSound]);

  const handleAcknowledge = async (alertId: number) => {
    try {
      setProcessingId(alertId);
      await alertApi.acknowledgeAlert(alertId, 'Staff');
      setActiveAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, status: 'Acknowledged' } : alert
        )
      );
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResolve = async (alertId: number) => {
    try {
      setProcessingId(alertId);
      await alertApi.resolveAlert(alertId, 'Staff');
      setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    } catch (error) {
      console.error('Error resolving alert:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (alertId: number) => {
    try {
      setProcessingId(alertId);
      await alertApi.markAsFalsePositive(alertId, 'Staff');
      setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    
    return date.toLocaleString('vi-VN');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Acknowledged':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Active':
        return 'Đang hoạt động';
      case 'Acknowledged':
        return 'Đã xác nhận';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeAlerts.length > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            {activeAlerts.length > 0 ? (
              <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
            ) : (
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Phát hiện té ngã</h2>
            <p className="text-sm text-slate-500">
              {activeAlerts.length > 0
                ? `Có ${activeAlerts.length} cảnh báo cần xử lý`
                : 'Không có cảnh báo nào'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-lg transition-colors ${
              soundEnabled ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
            }`}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Làm mới
          </button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-800">
                {activeAlerts.filter((a) => a.status === 'Active').length}
              </p>
              <p className="text-sm text-slate-500">Chưa xử lý</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-800">
                {activeAlerts.filter((a) => a.status === 'Acknowledged').length}
              </p>
              <p className="text-sm text-slate-500">Đang xử lý</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-800">0</p>
              <p className="text-sm text-slate-500">Đã xử lý hôm nay</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-slate-600"></div>
        </div>
      ) : activeAlerts.length > 0 ? (
        <div className="space-y-3">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border overflow-hidden transition-all ${
                alert.status === 'Active'
                  ? 'border-red-200 shadow-sm'
                  : 'border-amber-200'
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Alert Icon */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        alert.status === 'Active' ? 'bg-red-50' : 'bg-amber-50'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 ${
                          alert.status === 'Active' ? 'text-red-600' : 'text-amber-600'
                        }`}
                      />
                    </div>

                    {/* Alert Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-semibold text-slate-800">
                          Phát hiện té ngã #{alert.id}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-md ${getStatusColor(
                            alert.status
                          )}`}
                        >
                          {getStatusText(alert.status)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <User className="w-4 h-4 text-slate-400" />
                          <span>{alert.patientName || 'Không xác định'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span>{alert.location || 'Không rõ vị trí'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{formatTime(alert.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">Độ tin cậy:</span>
                          <span
                            className={`font-medium ${
                              alert.confidence >= 0.8
                                ? 'text-red-600'
                                : alert.confidence >= 0.6
                                ? 'text-amber-600'
                                : 'text-slate-600'
                            }`}
                          >
                            {Math.round(alert.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  {alert.status === 'Active' && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={processingId === alert.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" />
                      Xác nhận
                    </button>
                  )}
                  <button
                    onClick={() => handleResolve(alert.id)}
                    disabled={processingId === alert.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Đã xử lý
                  </button>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    disabled={processingId === alert.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Cảnh báo sai
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">Không có cảnh báo</h3>
          <p className="text-sm text-slate-500">
            Hệ thống đang hoạt động bình thường. Không phát hiện té ngã nào.
          </p>
        </div>
      )}

      {/* Test Alert Button (for development) */}
      <div className="bg-slate-50 rounded-xl p-5 border border-dashed border-slate-300">
        <h4 className="text-sm font-medium text-slate-700 mb-2">Kiểm tra hệ thống</h4>
        <p className="text-sm text-slate-500 mb-3">
          Tạo cảnh báo test để kiểm tra hệ thống hoạt động đúng.
        </p>
        <button
          onClick={async () => {
            try {
              await alertApi.createFallAlert({
                location: 'Phòng khám số 1',
                confidence: 0.85,
              });
              playAlertSound();
              fetchAlerts();
            } catch (error) {
              console.error('Error creating test alert:', error);
            }
          }}
          className="px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Tạo cảnh báo test
        </button>
      </div>
    </div>
  );
};

export default FallDetectionPage;
