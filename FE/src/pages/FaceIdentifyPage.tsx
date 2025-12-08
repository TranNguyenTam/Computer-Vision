import {
    Activity,
    AlertCircle,
    Calendar,
    Camera,
    CheckCircle2,
    Clock,
    CreditCard,
    FileText,
    Heart,
    Loader2,
    MapPin,
    Phone,
    Scan,
    User,
    UserCheck
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

const CAMERA_SERVER_URL = 'http://localhost:8080';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface PatientInfo {
  benhNhanId: number;
  maYTe: string;
  tenBenhNhan: string;
  gioiTinh?: string;
  tuoi?: number;
  ngaySinh?: string;
  soDienThoai?: string;
  diaChi?: string;
  nhomMau?: string;
  yeuToRh?: string;
  tienSuBenh?: string;
  hinhAnhDaiDien?: string;
  bhyt?: string; // Giả lập trường BHYT nếu chưa có
}

interface DetectionRecord {
  id: number;
  maYTe: string;
  patientName: string;
  confidence: number;
  detectedAt: string;
  cameraId: string;
  location: string;
}

const FaceIdentifyPage: React.FC = () => {
  const [serverOnline, setServerOnline] = useState(false);
  const [latestDetection, setLatestDetection] = useState<DetectionRecord | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [recentDetections, setRecentDetections] = useState<DetectionRecord[]>([]);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  // 1. Configure AI on mount (Kiosk Mode: Face ON, Fall OFF)
  useEffect(() => {
    const configureAI = async () => {
      try {
        // Check status first
        const statusRes = await fetch(`${CAMERA_SERVER_URL}/api/camera/status`);
        if (statusRes.ok) {
          setServerOnline(true);
          // Configure settings
          await fetch(`${CAMERA_SERVER_URL}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              face_recognition_enabled: true,
              fall_detection_enabled: false, // Hide fall boxes
              auto_detection_enabled: true   // Enable auto-record
            })
          });
        } else {
          setServerOnline(false);
        }
      } catch (e) {
        console.error("Failed to configure AI", e);
        setServerOnline(false);
      }
    };

    configureAI();
    // Re-check every 10s
    const interval = setInterval(configureAI, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. Poll for detections
  useEffect(() => {
    const fetchDetections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/face/detections/today`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data.length > 0) {
            const sorted = data.data; // Backend sorts desc
            setRecentDetections(sorted);
            
            const newest = sorted[0];
            // If new detection (different ID from current displayed), update
            if (!latestDetection || newest.id !== latestDetection.id) {
              setLatestDetection(newest);
              fetchPatientInfo(newest.maYTe);
            }
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    };

    const interval = setInterval(fetchDetections, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, [latestDetection]);

  const fetchPatientInfo = async (maYTe: string) => {
    setIsLoadingInfo(true);
    try {
      const response = await fetch(`${API_BASE_URL}/face/validate/${maYTe}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.patient) {
          setPatientInfo(data.patient);
        }
      }
    } catch (err) {
      console.error('Error fetching patient info:', err);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 overflow-hidden">
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-2rem)]">
        
        {/* LEFT: Camera Stream (8 cols) */}
        <div className="col-span-8 bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-slate-800">
          {serverOnline ? (
            <img 
              src={`${CAMERA_SERVER_URL}/api/stream`} 
              className="w-full h-full object-contain" 
              alt="Camera Stream"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
              <Camera className="w-20 h-20 mb-4 opacity-50" />
              <p className="text-xl">Đang kết nối Camera AI...</p>
            </div>
          )}
          
          {/* Status Overlay */}
          <div className="absolute top-6 left-6 flex gap-3">
            <div className={`px-4 py-2 rounded-full backdrop-blur-md border flex items-center gap-2 ${
              serverOnline 
                ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                : 'bg-red-500/20 border-red-500/30 text-red-400'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${serverOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-medium text-sm">
                {serverOnline ? "Hệ thống sẵn sàng" : "Mất kết nối"}
              </span>
            </div>
            
            <div className="px-4 py-2 rounded-full backdrop-blur-md border bg-blue-500/20 border-blue-500/30 text-blue-300 flex items-center gap-2">
              <Scan className="w-4 h-4" />
              <span className="font-medium text-sm">Auto-ID Active</span>
            </div>
          </div>

          {/* Distance Guide Overlay */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
             <div className="bg-black/60 backdrop-blur-sm text-white/80 px-6 py-3 rounded-full text-sm border border-white/10">
                ℹ️ Vui lòng đứng cách camera khoảng <b>1 mét</b> để nhận diện
             </div>
          </div>
        </div>

        {/* RIGHT: Info Panel (4 cols) */}
        <div className="col-span-4 flex flex-col gap-6 h-full">
          
          {/* 1. Main Patient Card */}
          <div className="flex-1 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Thông tin bệnh nhân
              </h2>
              {latestDetection && (
                <span className="text-blue-100 text-sm bg-blue-700 px-2 py-1 rounded">
                  {formatDate(latestDetection.detectedAt)}
                </span>
              )}
            </div>

            <div className="flex-1 p-6 relative">
              {isLoadingInfo ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
              ) : null}

              {patientInfo ? (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Avatar & Name */}
                  <div className="flex flex-col items-center mb-8">
                    <div className="w-32 h-32 rounded-full border-4 border-blue-100 shadow-lg overflow-hidden mb-4">
                      {patientInfo.hinhAnhDaiDien ? (
                        <img src={patientInfo.hinhAnhDaiDien} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                          <User className="w-16 h-16 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 text-center">{patientInfo.tenBenhNhan}</h3>
                    <p className="text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full mt-2">
                      {patientInfo.maYTe}
                    </p>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-slate-500 text-xs mb-1">Năm sinh / Tuổi</p>
                      <p className="font-semibold text-slate-700">
                        {patientInfo.ngaySinh ? new Date(patientInfo.ngaySinh).getFullYear() : '---'} 
                        {patientInfo.tuoi ? ` (${patientInfo.tuoi} tuổi)` : ''}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-slate-500 text-xs mb-1">Giới tính</p>
                      <p className="font-semibold text-slate-700">{patientInfo.gioiTinh || '---'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg col-span-2">
                      <p className="text-slate-500 text-xs mb-1">Địa chỉ</p>
                      <p className="font-semibold text-slate-700 truncate">{patientInfo.diaChi || 'Chưa cập nhật'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-slate-500 text-xs mb-1">Nhóm máu</p>
                      <p className="font-semibold text-red-600">{patientInfo.nhomMau || '---'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-slate-500 text-xs mb-1">BHYT</p>
                      <p className="font-semibold text-green-600">{patientInfo.bhyt || 'Có'}</p>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        <div>
                            <p className="text-green-800 font-bold">Đã xác thực</p>
                            <p className="text-green-600 text-xs">Dữ liệu đã được đồng bộ vào hệ thống</p>
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                  <Scan className="w-20 h-20 mb-6 opacity-20" />
                  <h3 className="text-lg font-semibold text-slate-500 mb-2">Chưa có thông tin</h3>
                  <p className="text-sm max-w-[200px]">
                    Hệ thống sẽ tự động hiển thị thông tin khi nhận diện được khuôn mặt
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Recent History List */}
          <div className="h-1/3 bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Lịch sử gần đây
              </h3>
              <span className="text-xs text-slate-400">{recentDetections.length} lượt hôm nay</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {recentDetections.map((record) => (
                <div 
                  key={record.id} 
                  className={`p-3 rounded-xl flex items-center gap-3 transition-colors ${
                    latestDetection?.id === record.id 
                      ? 'bg-blue-600/20 border border-blue-500/50' 
                      : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 font-bold text-xs">
                    {record.patientName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-medium text-sm truncate">{record.patientName}</p>
                    <p className="text-slate-400 text-xs">{record.maYTe}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-300 text-xs font-mono">{formatDate(record.detectedAt)}</p>
                    <p className="text-green-400 text-[10px]">{(record.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
              
              {recentDetections.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Chưa có lượt nhận diện nào
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FaceIdentifyPage;
