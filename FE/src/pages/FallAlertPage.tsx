import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Image,
  MapPin,
  RefreshCw,
  Video,
  XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { alertApi } from '../services/api';
import { FallAlert } from '../types';

const AI_SERVER_URL = import.meta.env.VITE_AI_URL || 'http://localhost:8000';

type TabType = 'realtime' | 'history';

const FallAlertPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('realtime');

  // ==================== REALTIME STATE ====================
  const [activeAlerts, setActiveAlerts] = useState<FallAlert[]>([]);
  const [loadingRealtime, setLoadingRealtime] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showVideoStream, setShowVideoStream] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<FallAlert | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [streamKey, setStreamKey] = useState(Date.now());
  const [cameraInfo, setCameraInfo] = useState<{
    name: string;
    location: string;
    id: string;
  } | null>(null);

  // ==================== HISTORY STATE ====================
  const [historyAlerts, setHistoryAlerts] = useState<FallAlert[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(7);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // ==================== REALTIME FUNCTIONS ====================
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

  const fetchActiveAlerts = useCallback(async () => {
    try {
      const data = await alertApi.getActiveAlerts();
      setActiveAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoadingRealtime(false);
    }
  }, []);

  // Configure AI settings on mount - Enable Fall Detection, Disable Face Recognition
  useEffect(() => {
    const configureAI = async () => {
      try {
        await fetch(`${AI_SERVER_URL}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fall_detection_enabled: true,
            face_recognition_enabled: false,
            show_bounding_box: true
          })
        });
      } catch (e) {
        console.error('Failed to configure AI settings:', e);
      }
    };
    configureAI();
  }, []);

  useEffect(() => {
    fetchActiveAlerts();

    // Check AI Server status
    const checkCameraStatus = async () => {
      try {
        const response = await fetch(`${AI_SERVER_URL}/api/camera/status`);
        if (response.ok) {
          const data = await response.json();
          setCameraStatus('online');
          if (data.camera) {
            setCameraInfo({
              name: data.camera.name || 'Unknown',
              location: data.camera.location || 'Unknown',
              id: data.camera.id || 'unknown'
            });
          }
        } else {
          setCameraStatus('offline');
        }
      } catch {
        setCameraStatus('offline');
      }
    };

    checkCameraStatus();
    const statusInterval = setInterval(checkCameraStatus, 5000);

    // SignalR realtime updates
    import('../services/signalr').then(({ default: signalRService }) => {
      signalRService.connect().then(() => {
        console.log('SignalR connected for Fall Detection');

        // Listen for new fall alerts
        signalRService.onFallAlert((alert) => {
          console.log('New fall alert received:', alert);
          setActiveAlerts((prev) => {
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
    const interval = setInterval(fetchActiveAlerts, 10000);
    return () => {
      clearInterval(interval);
      clearInterval(statusInterval);
    };
  }, [fetchActiveAlerts, playAlertSound]);

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

  // ==================== HISTORY FUNCTIONS ====================
  const fetchHistoryAlerts = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await alertApi.getAllAlerts(page, pageSize);
      setHistoryAlerts(data);
      // Estimate total count - if we get full page, there might be more
      if (data.length === pageSize) {
        setTotalCount(Math.max(totalCount, page * pageSize + 1));
      } else {
        setTotalCount((page - 1) * pageSize + data.length);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [page, pageSize, totalCount]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryAlerts();
    }
  }, [fetchHistoryAlerts, activeTab]);

  // ==================== HELPER FUNCTIONS ====================
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;

    return date.toLocaleString('vi-VN');
  };

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Acknowledged':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Resolved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'FalsePositive':
        return 'bg-gray-100 text-gray-700 border-gray-200';
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
      case 'Resolved':
        return 'Đã xử lý';
      case 'FalsePositive':
        return 'Cảnh báo sai';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'Acknowledged':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'Resolved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'FalsePositive':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const filteredHistoryAlerts = historyAlerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (dateFilter) {
      const alertDate = new Date(alert.timestamp).toISOString().split('T')[0];
      if (alertDate !== dateFilter) return false;
    }
    return true;
  });

  // Stats for history
  const totalAlerts = historyAlerts.length;
  const resolvedAlerts = historyAlerts.filter((a) => a.status === 'Resolved').length;
  const falsePositives = historyAlerts.filter((a) => a.status === 'FalsePositive').length;
  const avgConfidence =
    historyAlerts.length > 0
      ? Math.round((historyAlerts.reduce((sum, a) => sum + a.confidence, 0) / historyAlerts.length) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeAlerts.length > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            {activeAlerts.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Phát hiện té ngã</h2>
            <p className="text-xs text-slate-500">
              {activeAlerts.length > 0
                ? `Có ${activeAlerts.length} cảnh báo cần xử lý`
                : 'Không có cảnh báo nào'}
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('realtime')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'realtime'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Video className="w-3.5 h-3.5 inline-block mr-1.5" />
            Giám sát realtime
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 inline-block mr-1.5" />
            Lịch sử cảnh báo
          </button>
        </div>
      </div>

      {/* ==================== REALTIME TAB ==================== */}
      {activeTab === 'realtime' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-180px)]">
          {/* Camera Stream - 2/3 width */}
          {showVideoStream && (
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Video className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-800">
                      {cameraInfo ? cameraInfo.name : 'Camera AI - Giám sát té ngã'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {cameraInfo ? `📍 ${cameraInfo.location}` : 'Phát hiện té ngã realtime'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    cameraStatus === 'online' ? 'bg-emerald-100 text-emerald-700' :
                    cameraStatus === 'offline' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      cameraStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
                      cameraStatus === 'offline' ? 'bg-red-500' : 'bg-slate-400'
                    }`}></span>
                    {cameraStatus === 'online' ? 'Hoạt động' :
                     cameraStatus === 'offline' ? 'Mất kết nối' : 'Kiểm tra...'}
                  </div>
                  <button
                    onClick={() => setStreamKey(Date.now())}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Làm mới stream"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 relative bg-slate-900 min-h-0">
                <div className="absolute inset-0 flex items-center justify-center">
                  {cameraStatus === 'online' ? (
                    <img
                      key={streamKey}
                      src={`${AI_SERVER_URL}/api/stream?t=${streamKey}`}
                      alt="Fall Detection Stream"
                      className="w-full h-full object-contain"
                      onError={() => setCameraStatus('offline')}
                    />
                  ) : cameraStatus === 'offline' ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-6">
                      <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mb-3">
                        <Video className="w-7 h-7 opacity-50" />
                      </div>
                      <p className="text-sm font-medium mb-1">Không thể kết nối camera</p>
                      <p className="text-xs text-slate-500 mb-3">Kiểm tra AI Server</p>
                      <button
                        onClick={() => {
                          setCameraStatus('loading');
                          setStreamKey(Date.now());
                          setTimeout(() => {
                            fetch(`${AI_SERVER_URL}/api/camera/status`)
                              .then(res => setCameraStatus(res.ok ? 'online' : 'offline'))
                              .catch(() => setCameraStatus('offline'));
                          }, 500);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Thử lại
                      </button>
                    </div>
                  ) : (
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-400 border-t-white"></div>
                  )}
                </div>

                {/* Overlay Stats */}
                {cameraStatus === 'online' && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium backdrop-blur-sm ${
                      activeAlerts.length > 0 
                        ? 'bg-red-500/90 text-white' 
                        : 'bg-emerald-500/90 text-white'
                    }`}>
                      {activeAlerts.length > 0 
                        ? `⚠️ ${activeAlerts.length} cảnh báo` 
                        : '✓ An toàn'}
                    </div>
                    <div className="px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-xs text-white">
                      🕐 {new Date().toLocaleTimeString('vi-VN')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alerts Panel - 1/3 width */}
          <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  activeAlerts.length > 0 ? 'bg-red-100' : 'bg-emerald-100'
                }`}>
                  {activeAlerts.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-800">Cảnh báo</h3>
                  <p className="text-xs text-slate-500">
                    {activeAlerts.length > 0 ? `${activeAlerts.length} đang hoạt động` : 'Không có'}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    const location = cameraInfo?.location || 'Phòng khám số 1';
                    await alertApi.createFallAlert({ location, confidence: 0.85 });
                    playAlertSound();
                    fetchActiveAlerts();
                  } catch (error) {
                    console.error('Error creating test alert:', error);
                  }
                }}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                🧪 Test
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {loadingRealtime ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-slate-600"></div>
                </div>
              ) : activeAlerts.length > 0 ? (
                <div className="p-3 space-y-2">
                  {activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border transition-all ${
                        alert.status === 'Active'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            alert.status === 'Active' ? 'bg-red-200' : 'bg-amber-200'
                          }`}>
                            <AlertTriangle className={`w-3.5 h-3.5 ${
                              alert.status === 'Active' ? 'text-red-700' : 'text-amber-700'
                            }`} />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-800">#{alert.id}</span>
                            <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                              getStatusColor(alert.status)
                            }`}>
                              {getStatusText(alert.status)}
                            </span>
                          </div>
                        </div>
                        {alert.hasImage && (
                          <button
                            onClick={() => setSelectedAlert(alert)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Xem ảnh"
                          >
                            <Image className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-1 mb-2 text-xs text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {alert.location || 'Không rõ'}
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTime(alert.timestamp)}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Độ tin cậy:</span>
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                alert.confidence >= 0.8 ? 'bg-red-500' : 
                                alert.confidence >= 0.6 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${alert.confidence * 100}%` }}
                            />
                          </div>
                          <span className="font-medium text-slate-700">
                            {Math.round(alert.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {alert.status === 'Active' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={processingId === alert.id}
                            className="flex-1 px-2 py-1 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded transition-colors disabled:opacity-50"
                          >
                            Xác nhận
                          </button>
                        )}
                        <button
                          onClick={() => handleResolve(alert.id)}
                          disabled={processingId === alert.id}
                          className="flex-1 px-2 py-1 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors disabled:opacity-50"
                        >
                          Xử lý
                        </button>
                        <button
                          onClick={() => handleDismiss(alert.id)}
                          disabled={processingId === alert.id}
                          className="px-2 py-1 text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition-colors disabled:opacity-50"
                        >
                          Sai
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle className="w-7 h-7 text-emerald-500" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-1">An toàn</h4>
                  <p className="text-xs text-slate-500 text-center px-4">
                    Không phát hiện té ngã
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== HISTORY TAB ==================== */}
      {activeTab === 'history' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-slate-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Tổng cảnh báo</p>
              </div>
              <p className="text-xl font-semibold text-slate-800">{totalAlerts}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Đã xử lý</p>
              </div>
              <p className="text-xl font-semibold text-emerald-600">{resolvedAlerts}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Cảnh báo sai</p>
              </div>
              <p className="text-xl font-semibold text-slate-600">{falsePositives}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Độ tin cậy TB</p>
              </div>
              <p className="text-xl font-semibold text-blue-600">{avgConfidence}%</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">Lọc theo:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-colors"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Active">Đang hoạt động</option>
                <option value="Acknowledged">Đã xác nhận</option>
                <option value="Resolved">Đã xử lý</option>
                <option value="FalsePositive">Cảnh báo sai</option>
              </select>

              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-colors"
                />
              </div>

              {(statusFilter !== 'all' || dateFilter) && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setDateFilter('');
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>

          {/* Alerts Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {loadingHistory ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-600"></div>
              </div>
            ) : filteredHistoryAlerts.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Thời gian
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Vị trí
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Độ tin cậy
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Trạng thái
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistoryAlerts.map((alert) => (
                        <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-slate-600">#{alert.id}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {formatDateTime(alert.timestamp)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {alert.location || 'Không rõ'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-12 bg-slate-200 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full ${
                                    alert.confidence >= 0.8
                                      ? 'bg-red-500'
                                      : alert.confidence >= 0.6
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${alert.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-600">
                                {Math.round(alert.confidence * 100)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ${getStatusColor(
                                alert.status
                              )}`}
                            >
                              {getStatusIcon(alert.status)}
                              {getStatusText(alert.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50">
                  <p className="text-xs text-slate-500">
                    Trang {page} • Hiển thị {(page - 1) * pageSize + 1} - {(page - 1) * pageSize + filteredHistoryAlerts.length} 
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="px-2 py-1 text-xs border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Đầu
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1 border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                    <span className="px-3 py-1 bg-slate-800 text-white rounded-md text-xs font-medium min-w-[2rem] text-center">
                      {page}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={historyAlerts.length < pageSize}
                      className="p-1 border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-800 mb-1">Không có cảnh báo</h3>
                <p className="text-xs text-slate-500">Chưa có cảnh báo nào phù hợp với bộ lọc</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Image Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-800">
                Ảnh chụp té ngã #{selectedAlert.id}
              </h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-3">
              <div className="bg-black rounded-lg overflow-hidden">
                {selectedAlert.frameData ? (
                  <img
                    src={`data:image/jpeg;base64,${selectedAlert.frameData}`}
                    alt="Fall capture"
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="aspect-video flex items-center justify-center text-slate-400">
                    <p>Không có ảnh</p>
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Vị trí:</span>
                  <span className="ml-2 font-medium">{selectedAlert.location}</span>
                </div>
                <div>
                  <span className="text-slate-500">Thời gian:</span>
                  <span className="ml-2 font-medium">{formatTime(selectedAlert.timestamp)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Độ tin cậy:</span>
                  <span className="ml-2 font-medium text-red-600">
                    {Math.round(selectedAlert.confidence * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Trạng thái:</span>
                  <span className={`ml-2 font-medium ${
                    selectedAlert.status === 'Active' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {getStatusText(selectedAlert.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FallAlertPage;
