import {
    AlertCircle,
    Bell,
    Brain,
    Camera,
    CheckCircle,
    Database,
    RefreshCw,
    Save,
    Settings,
    Volume2,
    VolumeX,
    Wifi,
    XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { aiApi, dashboardApi } from '../services/api';
import { SystemStatus } from '../types';

const SettingsPage: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<{ status: string; models: string[] }>({ status: 'unknown', models: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    notifications: {
      sound: true,
      desktop: true,
      email: false,
    },
    fallDetection: {
      sensitivity: 0.7,
      minConfidence: 0.6,
      alertDelay: 2,
    },
    faceRecognition: {
      enabled: true,
      minConfidence: 0.8,
    },
    api: {
      backendUrl: 'http://localhost:5000',
      aiModuleUrl: 'http://localhost:8000',
    },
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [system, ai] = await Promise.all([
          dashboardApi.getStatus(),
          aiApi.getStatus(),
        ]);
        setSystemStatus(system);
        setAiStatus(ai);
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getStatusIcon = (status: string) => {
    if (status === 'online' || status === 'connected' || status === 'active') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (status === 'offline' || status === 'disconnected') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'online' || status === 'connected' || status === 'active') {
      return 'bg-green-100 text-green-700';
    }
    if (status === 'offline' || status === 'disconnected') {
      return 'bg-red-100 text-red-700';
    }
    return 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* System Status */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-slate-500" />
            Trạng thái hệ thống
          </h3>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Database</span>
                  </div>
                  {getStatusIcon(systemStatus?.services?.database || 'unknown')}
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${getStatusColor(systemStatus?.services?.database || 'unknown')}`}>
                  {systemStatus?.services?.database || 'Không xác định'}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">SignalR</span>
                  </div>
                  {getStatusIcon(systemStatus?.services?.signalR || 'unknown')}
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${getStatusColor(systemStatus?.services?.signalR || 'unknown')}`}>
                  {systemStatus?.services?.signalR || 'Không xác định'}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">AI Module</span>
                  </div>
                  {getStatusIcon(aiStatus.status)}
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${getStatusColor(aiStatus.status)}`}>
                  {aiStatus.status === 'online' ? 'Đang hoạt động' : 'Không kết nối'}
                </span>
              </div>
            </div>
          )}

          {systemStatus && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-500">
              <p>Phiên bản: {systemStatus.version}</p>
              <p>Cập nhật lần cuối: {new Date(systemStatus.timestamp).toLocaleString('vi-VN')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-500" />
            Cài đặt thông báo
          </h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.notifications.sound ? (
                <Volume2 className="w-4 h-4 text-slate-700" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-800">Âm thanh cảnh báo</p>
                <p className="text-xs text-slate-500">Phát âm thanh khi có cảnh báo mới</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications.sound}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, sound: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-800"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">Thông báo Desktop</p>
                <p className="text-xs text-slate-500">Hiển thị thông báo trên màn hình</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications.desktop}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, desktop: e.target.checked },
                  })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-800"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Fall Detection Settings */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Camera className="w-4 h-4 text-slate-500" />
            Cài đặt phát hiện té ngã
          </h3>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-800">Độ nhạy phát hiện</label>
              <span className="text-sm text-slate-500">
                {Math.round(settings.fallDetection.sensitivity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.1"
              value={settings.fallDetection.sensitivity}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fallDetection: {
                    ...settings.fallDetection,
                    sensitivity: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Thấp</span>
              <span>Cao</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-800">Độ tin cậy tối thiểu</label>
              <span className="text-sm text-slate-500">
                {Math.round(settings.fallDetection.minConfidence * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.4"
              max="0.95"
              step="0.05"
              value={settings.fallDetection.minConfidence}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fallDetection: {
                    ...settings.fallDetection,
                    minConfidence: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-800 block mb-2">
              Thời gian chờ xác nhận (giây)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.fallDetection.alertDelay}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fallDetection: {
                    ...settings.fallDetection,
                    alertDelay: parseInt(e.target.value),
                  },
                })
              }
              className="w-28 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* API Settings */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            Cài đặt kết nối
          </h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-800 block mb-2">Backend API URL</label>
            <input
              type="text"
              value={settings.api.backendUrl}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  api: { ...settings.api, backendUrl: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-800 block mb-2">AI Module URL</label>
            <input
              type="text"
              value={settings.api.aiModuleUrl}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  api: { ...settings.api, aiModuleUrl: e.target.value },
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            Đã lưu thành công!
          </span>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
