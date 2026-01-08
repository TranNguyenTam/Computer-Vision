import {
    Activity,
    AlertTriangle,
    Bell,
    Clock,
    MapPin,
    TrendingUp,
    UserCheck,
    Users
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { alertApi, dashboardApi } from '../services/api';
import { DashboardStats, DetectionEvent, FallAlert } from '../types';

interface DashboardPageProps {
  onNavigateToAlerts: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToAlerts }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<FallAlert[]>([]);
  const [recentDetections, setRecentDetections] = useState<DetectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsData, alertsData] = await Promise.all([
        dashboardApi.getStats(),
        alertApi.getActiveAlerts(),
      ]);
      setStats(statsData);
      setActiveAlerts(alertsData);
      if (statsData.recentDetections) {
        setRecentDetections(statsData.recentDetections);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // SignalR for realtime updates
    import('../services/signalr').then(({ default: signalRService }) => {
      signalRService.connect().then(() => {
        console.log('SignalR connected for Dashboard');
        
        // Listen for new fall alerts
        signalRService.onFallAlert((alert) => {
          console.log('Dashboard: New fall alert received:', alert);
          setActiveAlerts((prev) => {
            if (prev.some(a => a.id === alert.id)) return prev;
            return [alert, ...prev];
          });
          // Refresh stats
          fetchData();
        });
        
        // Listen for face recognition events
        signalRService.onFaceRecognition((detection) => {
          console.log('Dashboard: Face recognition event received:', detection);
          console.log('Current recentDetections:', recentDetections);
          setRecentDetections((prev) => {
            // Add to the beginning
            const newDetections = [detection, ...prev].slice(0, 10);
            console.log('Updated recentDetections:', newDetections);
            return newDetections;
          });
          // Don't refresh stats immediately, just update the list
        });
        
        // Listen for alert status updates
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
    
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-slate-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Tổng quan</h1>
          <p className="text-slate-500 text-sm mt-1">Hệ thống giám sát bệnh viện</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Tổng bệnh nhân</p>
              <p className="text-3xl font-semibold text-slate-800 mt-2">
                {stats?.totalPatients.toLocaleString() || 0}
              </p>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Từ database
              </p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-6 border transition-all ${
          stats?.activeAlerts 
            ? 'bg-red-50 border-red-200' 
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${stats?.activeAlerts ? 'text-red-600' : 'text-slate-500'}`}>
                Cảnh báo hoạt động
              </p>
              <p className={`text-3xl font-semibold mt-2 ${stats?.activeAlerts ? 'text-red-700' : 'text-slate-800'}`}>
                {stats?.activeAlerts || 0}
              </p>
              {stats?.activeAlerts ? (
                <button
                  onClick={onNavigateToAlerts}
                  className="text-xs text-red-600 mt-2 hover:underline"
                >
                  Xem chi tiết →
                </button>
              ) : (
                <p className="text-xs text-emerald-600 mt-2">Hệ thống ổn định</p>
              )}
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              stats?.activeAlerts ? 'bg-red-100' : 'bg-slate-100'
            }`}>
              <AlertTriangle className={`w-6 h-6 ${stats?.activeAlerts ? 'text-red-600' : 'text-slate-600'}`} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Phát hiện hôm nay</p>
              <p className="text-3xl font-semibold text-slate-800 mt-2">
                {stats?.patientsDetectedToday || 0}
              </p>
              <p className="text-xs text-slate-400 mt-2">Bệnh nhân nhận diện</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Cảnh báo hôm nay</p>
              <p className="text-3xl font-semibold text-slate-800 mt-2">
                {stats?.todayAlerts || activeAlerts.length}
              </p>
              <p className="text-xs text-slate-400 mt-2">Té ngã phát hiện</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium opacity-90">Hệ thống AI</h3>
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold">Hoạt động</p>
          <p className="text-xs opacity-75 mt-1">Camera & AI đang giám sát</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium opacity-90">Độ chính xác</h3>
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold">
            {stats?.avgConfidence ? `${Math.round(stats.avgConfidence * 100)}%` : '95%'}
          </p>
          <p className="text-xs opacity-75 mt-1">Trung bình nhận diện</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium opacity-90">Thời gian phản hồi</h3>
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold">&lt;2s</p>
          <p className="text-xs opacity-75 mt-1">Cảnh báo té ngã realtime</p>
        </div>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-medium text-red-800">Cảnh báo khẩn cấp</h3>
              <p className="text-red-600 text-sm">{activeAlerts.length} cảnh báo cần xử lý</p>
            </div>
          </div>
          <div className="space-y-2">
            {activeAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between bg-white rounded-lg p-4 border border-red-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <div>
                    <p className="font-medium text-slate-800">
                      {alert.patientName || 'Không xác định'}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {alert.location || 'Không rõ vị trí'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-sm font-medium text-red-600 bg-red-100 px-3 py-1 rounded-full">
                  {Math.round(alert.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
          {activeAlerts.length > 3 && (
            <button
              onClick={onNavigateToAlerts}
              className="mt-4 w-full py-2.5 text-center text-red-600 hover:text-red-700 font-medium text-sm border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              Xem tất cả {activeAlerts.length} cảnh báo
            </button>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Fall Alerts */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-medium text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-400" />
              Cảnh báo té ngã gần đây
            </h3>
          </div>
          <div className="p-5">
            {activeAlerts && activeAlerts.length > 0 ? (
              <div className="space-y-3">
                {activeAlerts.slice(0, 5).map((alert) => (
                  <div 
                    key={alert.id} 
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={onNavigateToAlerts}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      alert.status === 'Active' ? 'bg-red-500 animate-pulse' :
                      alert.status === 'Acknowledged' ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700">
                          Phát hiện té ngã #{alert.id}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          alert.status === 'Active' ? 'text-red-700 bg-red-100' :
                          alert.status === 'Acknowledged' ? 'text-amber-700 bg-amber-100' :
                          'text-emerald-700 bg-emerald-100'
                        }`}>
                          {alert.status === 'Active' ? 'Khẩn cấp' :
                           alert.status === 'Acknowledged' ? 'Đã xác nhận' : 'Đã xử lý'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {alert.location || 'Không rõ vị trí'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatTime(alert.timestamp)}
                        </p>
                        <p className={`text-xs font-medium ${
                          alert.confidence >= 0.8 ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {(alert.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Chưa có cảnh báo té ngã</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Face Recognition Detections */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-medium text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-400" />
              Nhận diện khuôn mặt gần đây
            </h3>
          </div>
          <div className="p-5">
            {recentDetections && recentDetections.length > 0 ? (
              <div className="space-y-3">
                {recentDetections.slice(0, 5).map((detection, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {detection.patientName}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-slate-500">
                          {detection.patientId}
                        </p>
                        {detection.location && (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {detection.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        {formatTime(detection.timestamp)}
                      </p>
                      {detection.confidence && (
                        <p className={`text-xs font-medium mt-0.5 ${
                          detection.confidence >= 0.8 ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {(detection.confidence * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentDetections && stats.recentDetections.length > 0 ? (
              <div className="space-y-3">
                {stats.recentDetections.slice(0, 5).map((detection, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {detection.patientName}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-slate-500">
                          {detection.patientId}
                        </p>
                        {detection.location && (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {detection.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        {formatTime(detection.timestamp)}
                      </p>
                      {detection.confidence && (
                        <p className={`text-xs font-medium mt-0.5 ${
                          detection.confidence >= 0.8 ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {(detection.confidence * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <UserCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Chưa có phát hiện</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Notification Badge */}
      {(activeAlerts.length > 0 || recentDetections.length > 0) && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <Bell className="w-4 h-4" />
          <span className="text-sm font-medium">Cập nhật realtime</span>
        </div>
      )}

      {/* System Status Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-medium text-slate-800 mb-4">Tình trạng hệ thống</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Phát hiện té ngã</p>
              <p className="text-sm font-semibold text-slate-800">Hoạt động bình thường</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Nhận diện khuôn mặt</p>
              <p className="text-sm font-semibold text-slate-800">Sẵn sàng</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Kết nối realtime</p>
              <p className="text-sm font-semibold text-slate-800">Đang hoạt động</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
