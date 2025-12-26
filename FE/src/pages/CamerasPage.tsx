import {
  Camera,
  Maximize2,
  RefreshCw,
  Settings,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Camera as CameraType } from '../types';

// Camera streaming server URL
const CAMERA_SERVER_URL = import.meta.env.VITE_AI_URL || 'http://localhost:8000';

// Mock camera data
const mockCameras: CameraType[] = [
  {
    id: 'cam-1',
    name: 'Camera Sảnh chính',
    location: 'Tầng 1 - Sảnh tiếp đón',
    status: 'online',
    aiEnabled: false,
    fallDetectionEnabled: false,
    faceRecognitionEnabled: false,
    lastActivity: new Date().toISOString(),
    streamUrl: `${CAMERA_SERVER_URL}/api/stream/raw`,
  },
  {
    id: 'cam-2',
    name: 'Camera Hành lang A',
    location: 'Tầng 2 - Khoa Nội',
    status: 'offline',
    aiEnabled: false,
    fallDetectionEnabled: false,
    faceRecognitionEnabled: false,
  },
];

const CamerasPage: React.FC = () => {
  const [cameras, setCameras] = useState<CameraType[]>(mockCameras);
  const [selectedCamera, setSelectedCamera] = useState<CameraType | null>(null);
  const [fullscreenCamera, setFullscreenCamera] = useState<CameraType | null>(null);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'loading'>('loading');

  // Check camera server status
  const checkServerStatus = useCallback(async () => {
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/status`);
      if (response.ok) {
        const data = await response.json();
        setServerStatus('online'); 
        
        // Update first camera status
        setCameras(prev => prev.map((cam, index) => 
          index === 0 ? { 
            ...cam, 
            status: data.connected ? 'online' : 'offline',
          } : cam
        ));
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 5000);
    return () => clearInterval(interval);
  }, [checkServerStatus]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Đang hoạt động';
      case 'offline':
        return 'Không kết nối';
      case 'error':
        return 'Lỗi';
      default:
        return status;
    }
  };

  const formatLastActivity = (timestamp?: string) => {
    if (!timestamp) return 'Không có dữ liệu';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    return date.toLocaleTimeString('vi-VN');
  };

  const onlineCameras = cameras.filter((c) => c.status === 'online').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Quản lý Camera</h1>
          <p className="text-slate-500 text-sm mt-1">Giám sát hệ thống camera</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
            serverStatus === 'online' 
              ? 'bg-emerald-50 text-emerald-700' 
              : serverStatus === 'offline'
              ? 'bg-red-50 text-red-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              serverStatus === 'online' 
                ? 'bg-emerald-500 animate-pulse' 
                : serverStatus === 'offline'
                ? 'bg-red-500'
                : 'bg-slate-400'
            }`}></span>
            {serverStatus === 'online' ? 'Server kết nối' : serverStatus === 'offline' ? 'Server ngắt kết nối' : 'Đang kiểm tra...'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-slate-100 rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-800">{cameras.length}</p>
              <p className="text-sm text-slate-500">Tổng camera</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Wifi className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-800">{onlineCameras}</p>
              <p className="text-sm text-slate-500">Đang hoạt động</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-red-50 rounded-lg flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-800">{cameras.length - onlineCameras}</p>
              <p className="text-sm text-slate-500">Ngoại tuyến</p>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {cameras.map((camera) => (
          <div
            key={camera.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all"
          >
            {/* Camera Preview */}
            <div className="relative aspect-video bg-slate-900">
              {camera.status === 'online' && camera.streamUrl ? (
                <img 
                  src={camera.streamUrl}
                  alt={camera.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : camera.status === 'online' ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-slate-500">
                    <Video className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Đang kết nối...</p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <div className="text-center text-slate-500">
                    <VideoOff className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Không kết nối</p>
                  </div>
                </div>
              )}

              {/* Status badge */}
              <div className="absolute top-3 left-3">
                <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md ${
                  camera.status === 'online' 
                    ? 'bg-emerald-500/90 text-white' 
                    : 'bg-slate-600/90 text-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-white ${camera.status === 'online' ? 'animate-pulse' : 'opacity-50'}`}></span>
                  {getStatusText(camera.status)}
                </span>
              </div>

              {/* Controls */}
              {camera.status === 'online' && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setFullscreenCamera(camera)}
                      className="p-1.5 bg-white/10 backdrop-blur-sm rounded text-white hover:bg-white/20 transition-colors"
                      title="Phóng to"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={checkServerStatus}
                      className="p-1.5 bg-white/10 backdrop-blur-sm rounded text-white hover:bg-white/20 transition-colors"
                      title="Làm mới"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs text-white/80 bg-black/40 backdrop-blur-sm px-2 py-1 rounded">
                    {formatLastActivity(camera.lastActivity)}
                  </span>
                </div>
              )}
            </div>

            {/* Camera Info */}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-slate-800">{camera.name}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{camera.location}</p>
                </div>
                <button
                  onClick={() => setSelectedCamera(camera)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Camera
      <div className="bg-slate-50 rounded-xl p-6 border border-dashed border-slate-300 text-center hover:border-slate-400 transition-colors">
        <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="font-medium text-slate-700 mb-1">Thêm Camera mới</h3>
        <p className="text-sm text-slate-500 mb-4">Kết nối camera IP hoặc webcam</p>
        <button className="px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium">
          Thêm Camera
        </button>
      </div> */}

      {/* Camera Settings Modal */}
      {/* {selectedCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-medium text-slate-800">Cài đặt Camera</h3>
              <button
                onClick={() => setSelectedCamera(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">Tên camera</label>
                <input
                  type="text"
                  value={selectedCamera.name}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all text-sm"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">Vị trí</label>
                <input
                  type="text"
                  value={selectedCamera.location}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all text-sm"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1.5">Stream URL</label>
                <input
                  type="text"
                  value={selectedCamera.streamUrl || 'Không có'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all text-sm font-mono"
                  readOnly
                />
              </div>
              <div className="pt-3">
                <button
                  onClick={() => setSelectedCamera(null)}
                  className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )} */}

      {/* Fullscreen Modal */}
      {fullscreenCamera && (
        <div className="fixed inset-0 z-50 bg-black">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-white font-medium">{fullscreenCamera.name}</h3>
                  <p className="text-white/60 text-sm">{fullscreenCamera.location}</p>
                </div>
              </div>
              <button
                onClick={() => setFullscreenCamera(null)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Video Stream */}
          <div className="w-full h-full flex items-center justify-center">
            {fullscreenCamera.streamUrl ? (
              <img 
                src={fullscreenCamera.streamUrl}
                alt={fullscreenCamera.name}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="text-center text-white/60">
                <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Không có tín hiệu video</p>
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          {/* <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={checkServerStatus}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </button>
            </div>
          </div> */}
        </div>
      )}
    </div>
  );
};

export default CamerasPage;
