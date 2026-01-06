import {
    Activity,
    AlertTriangle,
    Calendar,
    Clock,
    MapPin,
    TrendingUp,
    UserCheck,
    Users
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { alertApi, dashboardApi } from '../services/api';
import { DashboardStats, FallAlert } from '../types';

interface DashboardPageProps {
  onNavigateToAlerts: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToAlerts }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<FallAlert[]>([]);
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
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
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
                {(stats?.totalPatients ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Từ sơ sở dữ liệu
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
                <p className="text-xs text-emerald-600 mt-2"></p>
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

        {/* Fall Detection Stats Card */}
        <div className={`rounded-xl p-6 border transition-all ${
          (stats?.totalFallsToday ?? 0) > 0 
            ? 'bg-orange-50 border-orange-200' 
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${(stats?.totalFallsToday ?? 0) > 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                Té ngã hôm nay
              </p>
              <p className={`text-3xl font-semibold mt-2 ${(stats?.totalFallsToday ?? 0) > 0 ? 'text-orange-700' : 'text-slate-800'}`}>
                {stats?.totalFallsToday || 0}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Tuần: {stats?.totalFallsThisWeek || 0}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-400">
                  Tháng: {stats?.totalFallsThisMonth || 0}
                </span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              (stats?.totalFallsToday ?? 0) > 0 ? 'bg-orange-100' : 'bg-slate-100'
            }`}>
              <Activity className={`w-6 h-6 ${(stats?.totalFallsToday ?? 0) > 0 ? 'text-orange-600' : 'text-slate-600'}`} />
            </div>
          </div>
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
        {/* Recent Alerts */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-medium text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-400" />
              Cảnh báo gần đây
            </h3>
          </div>
          <div className="p-5">
            {stats?.recentAlerts && stats.recentAlerts.length > 0 ? (
              <div className="space-y-3">
                {stats.recentAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-center gap-3 py-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      alert.status === 'Active' ? 'bg-red-500' :
                      alert.status === 'Acknowledged' ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">
                        {alert.patientName || 'Không xác định'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {alert.location} · {formatTime(alert.timestamp)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      alert.status === 'Active' ? 'text-red-600 bg-red-50' :
                      alert.status === 'Acknowledged' ? 'text-amber-600 bg-amber-50' :
                      'text-emerald-600 bg-emerald-50'
                    }`}>
                      {alert.status === 'Active' ? 'Hoạt động' :
                       alert.status === 'Acknowledged' ? 'Đã xác nhận' : 'Đã xử lý'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Chưa có cảnh báo</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Detections */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-medium text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-400" />
              Nhận diện gần đây
            </h3>
          </div>
          <div className="p-5">
            {stats?.recentDetections && stats.recentDetections.length > 0 ? (
              <div className="space-y-3">
                {stats.recentDetections.slice(0, 5).map((detection, index) => (
                  <div key={index} className="flex items-center gap-3 py-2">
                    <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate font-medium">
                        {detection.patientName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {detection.patientId} · {detection.location || 'Cổng chính'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500">
                        {formatTime(detection.timestamp)}
                      </span>
                      {detection.confidence && (
                        <p className={`text-xs font-medium ${
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
    </div>
  );
};

export default DashboardPage;
