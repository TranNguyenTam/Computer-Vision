import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Filter,
    MapPin,
    User,
    XCircle
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { alertApi } from '../services/api';
import { FallAlert } from '../types';

const AlertsHistoryPage: React.FC = () => {
  const [alerts, setAlerts] = useState<FallAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await alertApi.getAllAlerts(page, pageSize);
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-red-100 text-red-700';
      case 'Acknowledged':
        return 'bg-yellow-100 text-yellow-700';
      case 'Resolved':
        return 'bg-green-100 text-green-700';
      case 'FalsePositive':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (dateFilter) {
      const alertDate = new Date(alert.timestamp).toISOString().split('T')[0];
      if (alertDate !== dateFilter) return false;
    }
    return true;
  });

  // Stats
  const totalAlerts = alerts.length;
  const resolvedAlerts = alerts.filter((a) => a.status === 'Resolved').length;
  const falsePositives = alerts.filter((a) => a.status === 'FalsePositive').length;
  const avgConfidence =
    alerts.length > 0
      ? Math.round((alerts.reduce((sum, a) => sum + a.confidence, 0) / alerts.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Tổng cảnh báo</p>
          </div>
          <p className="text-2xl font-semibold text-slate-800">{totalAlerts}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Đã xử lý</p>
          </div>
          <p className="text-2xl font-semibold text-emerald-600">{resolvedAlerts}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Cảnh báo sai</p>
          </div>
          <p className="text-2xl font-semibold text-slate-600">{falsePositives}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Độ tin cậy TB</p>
          </div>
          <p className="text-2xl font-semibold text-blue-600">{avgConfidence}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Lọc theo:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-colors"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Active">Đang hoạt động</option>
            <option value="Acknowledged">Đã xác nhận</option>
            <option value="Resolved">Đã xử lý</option>
            <option value="FalsePositive">Cảnh báo sai</option>
          </select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-colors"
            />
          </div>

          {(statusFilter !== 'all' || dateFilter) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setDateFilter('');
              }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Xóa bộ lọc
            </button>
          )}

          <div className="ml-auto">
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
              <Download className="w-4 h-4" />
              Xuất báo cáo
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-slate-600"></div>
          </div>
        ) : filteredAlerts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Thời gian
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Bệnh nhân
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Vị trí
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Độ tin cậy
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAlerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-sm text-slate-600">#{alert.id}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {formatDateTime(alert.timestamp)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-800">
                            {alert.patientName || 'Không xác định'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {alert.location || 'Không rõ'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-14 bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                alert.confidence >= 0.8
                                  ? 'bg-red-500'
                                  : alert.confidence >= 0.6
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${alert.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-600">
                            {Math.round(alert.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md ${getStatusColor(
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
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">
                Hiển thị {filteredAlerts.length} cảnh báo
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="px-3 py-1.5 bg-slate-800 text-white rounded-md text-sm font-medium">
                  {page}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={alerts.length < pageSize}
                  className="p-1.5 border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-base font-medium text-slate-800 mb-1">Không có cảnh báo</h3>
            <p className="text-sm text-slate-500">Chưa có cảnh báo nào phù hợp với bộ lọc</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsHistoryPage;
