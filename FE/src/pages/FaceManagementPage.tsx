import {
    AlertCircle,
    Camera,
    Check,
    CheckCircle2,
    Clock,
    History,
    Loader2,
    Plus,
    Scan,
    Search,
    Trash2,
    Upload,
    User,
    UserCheck,
    UserPlus,
    Users,
    X
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useSignalR } from '../hooks/useSignalR';
import { DetectionEvent } from '../types';

const CAMERA_SERVER_URL = 'http://localhost:8080';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type TabType = 'register' | 'identify';

interface RegisteredFace {
  person_id: string;
  person_name: string;
  person_type: 'patient';
  image_path?: string;
  image_count?: number;
  image_paths?: string[];
}

interface AISettings {
  ai_enabled: boolean;
  fall_detection_enabled: boolean;
  face_recognition_enabled: boolean;
  auto_detection_enabled?: boolean;
}

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
  bhyt?: string;
}

interface SearchResult {
  patients: PatientInfo[];
  loading: boolean;
}

interface DetectionRecord {
  id: number;
  maYTe: string;
  patientName: string;
  confidence: number;
  detectedAt: string;
  cameraId?: string;
  location?: string;
}

const FaceManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('identify');

  // ==================== REGISTER STATE ====================
  const [faces, setFaces] = useState<RegisteredFace[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Detection history for register tab
  const [detectionsToday, setDetectionsToday] = useState<DetectionRecord[]>([]);
  const [loadingDetections, setLoadingDetections] = useState(false);

  // Registration modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerData, setRegisterData] = useState({
    person_id: '',
    person_name: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registerProgress, setRegisterProgress] = useState({ current: 0, total: 0 });
  const [registerResult, setRegisterResult] = useState<{ success: boolean; message: string } | null>(null);

  // Patient search for registration
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult>({ patients: [], loading: false });
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null);

  // Patient detail modal
  const [showPatientDetail, setShowPatientDetail] = useState(false);
  const [patientDetail, setPatientDetail] = useState<PatientInfo | null>(null);
  const [loadingPatientDetail, setLoadingPatientDetail] = useState(false);

  // ==================== IDENTIFY STATE ====================
  const [latestDetection, setLatestDetection] = useState<DetectionRecord | null>(null);
  const [identifyPatientInfo, setIdentifyPatientInfo] = useState<PatientInfo | null>(null);
  const [recentDetections, setRecentDetections] = useState<DetectionRecord[]>([]);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // ==================== SIGNALR ====================
  useSignalR({
    onPatientDetected: useCallback((event: DetectionEvent) => {
      setDetectionsToday((prev) => {
        const exists = prev.some(d => d.maYTe === event.patientId);
        if (exists) return prev;

        const newDetection: DetectionRecord = {
          id: Date.now(),
          maYTe: event.patientId,
          patientName: event.patientName,
          confidence: 0,
          detectedAt: new Date().toISOString(),
          location: event.location
        };

        return [newDetection, ...prev];
      });
    }, [])
  });

  // ==================== REGISTER FUNCTIONS ====================
  const fetchDetectionsToday = useCallback(async () => {
    setLoadingDetections(true);
    try {
      const response = await fetch(`${API_BASE_URL}/face/detections/today`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDetectionsToday(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching detections:', error);
    } finally {
      setLoadingDetections(false);
    }
  }, []);

  const fetchFaces = useCallback(async () => {
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/faces`);
      if (response.ok) {
        const data = await response.json();
        const mappedFaces = (data.faces || []).map((face: { id?: string; person_id?: string; name?: string; person_name?: string; image_count?: number }) => ({
          person_id: face.person_id || face.id || '',
          person_name: face.person_name || face.name || face.person_id || face.id || '',
          person_type: 'patient' as const,
          image_count: face.image_count || 0,
        }));
        setFaces(mappedFaces);
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchFaces();
    fetchSettings();
    fetchDetectionsToday();

    const interval = setInterval(fetchDetectionsToday, 30000);
    return () => clearInterval(interval);
  }, [fetchFaces, fetchSettings, fetchDetectionsToday]);

  // Configure AI settings based on active tab
  useEffect(() => {
    const configureAI = async () => {
      try {
        await fetch(`${CAMERA_SERVER_URL}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            face_recognition_enabled: true,
            fall_detection_enabled: false,
            show_bounding_box: true,
            auto_detection_enabled: activeTab === 'identify'
          })
        });
      } catch (e) {
        console.error('Failed to configure AI settings:', e);
      }
    };
    configureAI();
  }, [activeTab]);

  // Search patients
  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults({ patients: [], loading: false });
      return;
    }

    setSearchResults(prev => ({ ...prev, loading: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/face/search-patient?term=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults({ patients: data.patients || [], loading: false });
      } else {
        setSearchResults({ patients: [], loading: false });
      }
    } catch {
      setSearchResults({ patients: [], loading: false });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearch) {
        searchPatients(patientSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearch, searchPatients]);

  const handleSelectPatient = (patient: PatientInfo) => {
    setSelectedPatient(patient);
    setRegisterData({
      person_id: patient.maYTe,
      person_name: patient.tenBenhNhan
    });
    setPatientSearch('');
    setSearchResults({ patients: [], loading: false });
  };

  const fetchPatientDetail = async (maYTe: string) => {
    setLoadingPatientDetail(true);
    setShowPatientDetail(true);
    setPatientDetail(null);
    try {
      const response = await fetch(`${API_BASE_URL}/face/patient/${encodeURIComponent(maYTe)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.patient) {
          setPatientDetail(data.patient);
        }
      }
    } catch (error) {
      console.error('Failed to fetch patient detail:', error);
    } finally {
      setLoadingPatientDetail(false);
    }
  };

  const handleRegister = async () => {
    if (!registerData.person_id || !registerData.person_name) {
      setRegisterResult({ success: false, message: 'Vui lòng chọn bệnh nhân từ database' });
      return;
    }

    if (!selectedPatient) {
      setRegisterResult({ success: false, message: 'Vui lòng chọn bệnh nhân từ danh sách tìm kiếm' });
      return;
    }

    setRegistering(true);
    setRegisterResult(null);

    try {
      if (selectedFiles.length === 0) {
        setRegisterResult({ success: false, message: 'Vui lòng chọn ít nhất 1 ảnh' });
        setRegistering(false);
        return;
      }

      setRegisterProgress({ current: 0, total: selectedFiles.length });
      let successCount = 0;
      let lastError = '';

      for (let i = 0; i < selectedFiles.length; i++) {
        setRegisterProgress({ current: i + 1, total: selectedFiles.length });

        const formData = new FormData();
        formData.append('person_id', registerData.person_id);
        formData.append('person_name', registerData.person_name);
        formData.append('person_type', 'patient');
        formData.append('image', selectedFiles[i]);

        try {
          const response = await fetch(`${CAMERA_SERVER_URL}/api/faces/register`, {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          if (result.success) {
            successCount++;
          } else {
            lastError = result.error || 'Lỗi không xác định';
          }
        } catch {
          lastError = 'Không thể kết nối server';
        }
      }

      if (successCount === selectedFiles.length) {
        setRegisterResult({
          success: true,
          message: `Đăng ký thành công ${successCount} ảnh cho ${registerData.person_name}!`
        });
        fetchFaces();
        setTimeout(() => {
          closeRegisterModal();
        }, 2000);
      } else if (successCount > 0) {
        setRegisterResult({
          success: true,
          message: `Đăng ký ${successCount}/${selectedFiles.length} ảnh. Lỗi: ${lastError}`
        });
        fetchFaces();
      } else {
        setRegisterResult({ success: false, message: lastError || 'Đăng ký thất bại' });
      }
    } catch (error) {
      setRegisterResult({ success: false, message: 'Không thể kết nối server' });
    } finally {
      setRegistering(false);
    }
  };

  const closeRegisterModal = () => {
    setShowRegisterModal(false);
    setRegisterData({ person_id: '', person_name: '' });
    setSelectedFiles([]);
    setRegisterResult(null);
    setRegisterProgress({ current: 0, total: 0 });
    setSelectedPatient(null);
    setPatientSearch('');
    setSearchResults({ patients: [], loading: false });
  };

  const handleDelete = async (personId: string) => {
    if (!confirm('Bạn có chắc muốn xóa khuôn mặt này?')) return;

    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/faces/${personId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchFaces();
      }
    } catch (error) {
      console.error('Failed to delete face:', error);
    }
  };

  const filteredFaces = faces.filter(face =>
    (face.person_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (face.person_id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredFaces.length / itemsPerPage);
  const currentFaces = filteredFaces.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // ==================== IDENTIFY FUNCTIONS ====================
  useEffect(() => {
    if (activeTab !== 'identify') return;

    const checkCameraStatus = async () => {
      try {
        const statusRes = await fetch(`${CAMERA_SERVER_URL}/api/camera/status`);
        if (statusRes.ok) {
          setServerOnline(true);
        } else {
          setServerOnline(false);
        }
      } catch {
        setServerOnline(false);
      }
    };

    checkCameraStatus();
    const interval = setInterval(checkCameraStatus, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'identify') return;

    const fetchDetections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/face/detections/today`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            const sorted = data.data;
            setRecentDetections(sorted);

            const newest = sorted[0];
            if (!latestDetection || newest.id !== latestDetection.id) {
              setLatestDetection(newest);
            }
          }
        }

        const currentRes = await fetch(`${CAMERA_SERVER_URL}/api/faces/current-detection`);
        if (currentRes.ok) {
          const currentData = await currentRes.json();

          if (currentData.has_detection && currentData.persons.length > 0) {
            const currentPerson = currentData.persons[0];
            const currentMaYTe = currentPerson.id;

            if (!identifyPatientInfo || identifyPatientInfo.maYTe !== currentMaYTe) {
              fetchIdentifyPatientInfo(currentMaYTe);
            }
          } else {
            setIdentifyPatientInfo(null);
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    };

    fetchDetections();
    const interval = setInterval(fetchDetections, 1000);
    return () => clearInterval(interval);
  }, [activeTab, identifyPatientInfo, latestDetection]);

  const fetchIdentifyPatientInfo = async (maYTe: string) => {
    setIsLoadingInfo(true);
    try {
      const response = await fetch(`${API_BASE_URL}/face/validate/${maYTe}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.patient) {
          setIdentifyPatientInfo(data.patient);
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
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50">
            <UserCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Nhận dạng khuôn mặt</h2>
            <p className="text-sm text-slate-500">Quản lý và nhận diện khuôn mặt bệnh nhân</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('identify')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'identify'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Scan className="w-4 h-4 inline-block mr-2" />
            Nhận diện
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'register'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4 inline-block mr-2" />
            Đăng ký khuôn mặt
          </button>
        </div>
      </div>

      {/* ==================== REGISTER TAB ==================== */}
      {activeTab === 'register' && (
        <>
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
                serverOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {serverOnline ? 'Server kết nối' : 'Server ngắt kết nối'}
              </span>
            </div>

            <button
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Đăng ký mới
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-800">{faces.length}</p>
                  <p className="text-sm text-slate-500">Bệnh nhân đã đăng ký</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-800">{detectionsToday.length}</p>
                  <p className="text-sm text-slate-500">Nhận diện hôm nay</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-violet-50 rounded-lg flex items-center justify-center">
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-amber-50 rounded-lg flex items-center justify-center">
                </div>
              </div>
            </div>
          </div>

          {/* Detections Today */}
          {detectionsToday.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-medium text-slate-800 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  Nhận diện hôm nay
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {detectionsToday.slice(0, 9).map((detection) => (
                    <div
                      key={detection.id}
                      onClick={() => fetchPatientDetail(detection.maYTe)}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{detection.patientName}</p>
                        <p className="text-xs text-slate-500">
                          {detection.maYTe} • {new Date(detection.detectedAt).toLocaleTimeString('vi-VN')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          detection.confidence >= 0.8
                            ? 'bg-emerald-100 text-emerald-700'
                            : detection.confidence >= 0.7
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {(detection.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {detectionsToday.length > 9 && (
                  <p className="text-center text-sm text-slate-500 mt-3">
                    +{detectionsToday.length - 9} bệnh nhân khác
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Registered Faces List */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-medium text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Bệnh nhân đã đăng ký khuôn mặt
              </h3>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all text-sm"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : filteredFaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Users className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Chưa có khuôn mặt nào</p>
                <p className="text-sm mt-1">Nhấn "Đăng ký mới" để thêm khuôn mặt</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                        <th className="px-4 py-3">Mã Y Tế</th>
                        <th className="px-4 py-3">Tên Bệnh Nhân</th>
                        <th className="px-4 py-3">Loại</th>
                        <th className="px-4 py-3 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentFaces.map((face) => (
                        <tr key={face.person_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{face.person_id}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{face.person_name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {face.person_type === 'patient' ? 'Bệnh nhân' : face.person_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDelete(face.person_id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <div className="text-sm text-slate-500">
                      Hiển thị {((currentPage - 1) * itemsPerPage) + 1} đến {Math.min(currentPage * itemsPerPage, filteredFaces.length)} trong số {filteredFaces.length} bệnh nhân
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Trước
                      </button>
                      <span className="px-3 py-1 text-sm bg-slate-100 rounded">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ==================== IDENTIFY TAB ==================== */}
      {activeTab === 'identify' && (
        <div className="grid grid-cols-12 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
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
            {/* Main Patient Card */}
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

                {identifyPatientInfo ? (
                  <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto">
                    {/* Header - Name & ID */}
                    <div className="flex-shrink-0 mb-4 pb-4 border-b border-slate-200">
                      <h3 className="text-xl font-bold text-slate-800">{identifyPatientInfo.tenBenhNhan}</h3>
                      <p className="text-blue-600 font-medium text-sm mt-1">
                        Mã Y Tế: {identifyPatientInfo.maYTe}
                      </p>
                    </div>

                    {/* Details Grid - Compact */}
                    <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Năm sinh</p>
                        <p className="font-semibold text-slate-700">
                          {identifyPatientInfo.ngaySinh ? new Date(identifyPatientInfo.ngaySinh).getFullYear() : '---'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Tuổi</p>
                        <p className="font-semibold text-slate-700">{identifyPatientInfo.tuoi || '---'}</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Giới tính</p>
                        <p className="font-semibold text-slate-700">{identifyPatientInfo.gioiTinh || '---'}</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Nhóm máu</p>
                        <p className="font-semibold text-red-600">{identifyPatientInfo.nhomMau || '---'}</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg col-span-2">
                        <p className="text-slate-500 text-xs mb-1">Địa chỉ</p>
                        <p className="font-semibold text-slate-700 text-xs leading-relaxed">{identifyPatientInfo.diaChi || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">Số điện thoại</p>
                        <p className="font-semibold text-slate-700">{identifyPatientInfo.soDienThoai || '---'}</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <p className="text-slate-500 text-xs mb-1">BHYT</p>
                        <p className="font-semibold text-green-600">{identifyPatientInfo.bhyt || 'Có'}</p>
                      </div>
                      {identifyPatientInfo.tienSuBenh && (
                        <div className="bg-amber-50 p-2.5 rounded-lg col-span-2">
                          <p className="text-amber-700 text-xs mb-1">⚠️ Tiền sử bệnh</p>
                          <p className="font-medium text-amber-900 text-xs leading-relaxed">{identifyPatientInfo.tienSuBenh}</p>
                        </div>
                      )}
                    </div>

                    {/* Footer Status */}
                    <div className="flex-shrink-0 mt-4 pt-4 border-t border-slate-200">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-green-800 font-semibold text-sm">Đã xác thực</p>
                          <p className="text-green-600 text-xs">Dữ liệu đồng bộ hệ thống</p>
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

            {/* History Button */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl p-4 flex items-center justify-between transition-colors border border-slate-700"
            >
              <div className="flex items-center gap-3">
                <History className="w-5 h-5" />
                <span className="font-medium">Xem lịch sử nhận diện</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">{recentDetections.length} hôm nay</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-slate-800">Đăng ký khuôn mặt bệnh nhân</h3>
              <button
                onClick={closeRegisterModal}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <strong>💡 Lưu ý:</strong> Có thể đăng ký nhiều ảnh cho cùng một bệnh nhân (cùng MAYTE)
                để tăng độ chính xác nhận dạng. Nên chụp từ nhiều góc khác nhau.
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Tìm kiếm bệnh nhân từ hệ thống *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nhập MAYTE hoặc tên bệnh nhân..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 text-sm"
                  />
                  {searchResults.loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                  )}
                </div>

                {searchResults.patients.length > 0 && !selectedPatient && (
                  <div className="mt-2 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                    {searchResults.patients.map((patient) => (
                      <button
                        key={patient.maYTe}
                        onClick={() => handleSelectPatient(patient)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left"
                      >
                        <User className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-700">{patient.tenBenhNhan}</p>
                          <p className="text-xs text-slate-500">
                            MAYTE: {patient.maYTe} {patient.gioiTinh && `| ${patient.gioiTinh}`} {patient.tuoi && `| ${patient.tuoi} tuổi`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedPatient && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-800">{selectedPatient.tenBenhNhan}</p>
                        <p className="text-sm text-emerald-600">MAYTE: {selectedPatient.maYTe}</p>
                        <p className="text-xs text-emerald-500">
                          {selectedPatient.gioiTinh && `${selectedPatient.gioiTinh}`}{selectedPatient.tuoi && ` | ${selectedPatient.tuoi} tuổi`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPatient(null);
                        setRegisterData({ person_id: '', person_name: '' });
                        setPatientSearch('');
                      }}
                      className="text-emerald-600 hover:text-emerald-700 text-sm"
                    >
                      Đổi
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-600 mb-2">Tải ảnh lên *</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6">
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setSelectedFiles(files);
                    }}
                    className="hidden"
                    id="face-upload"
                  />
                  <label
                    htmlFor="face-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    {selectedFiles.length > 0 ? (
                      <>
                        <Check className="w-8 h-8 text-emerald-500 mb-2" />
                        <p className="text-sm text-slate-700 font-medium">
                          Đã chọn {selectedFiles.length} ảnh
                        </p>
                        <div className="mt-2 max-h-20 overflow-y-auto text-xs text-slate-500">
                          {selectedFiles.map((f, i) => (
                            <div key={i} className="truncate max-w-[200px]">{f.name}</div>
                          ))}
                        </div>
                        <p className="text-xs text-blue-600 mt-2">Nhấn để chọn lại</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-sm text-slate-500">Nhấn để chọn ảnh</p>
                        <p className="text-xs text-slate-400 mt-1">Hỗ trợ: JPG, PNG, HEIC</p>
                        <p className="text-xs text-blue-600 mt-1">Có thể chọn nhiều ảnh cùng lúc</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {!selectedPatient && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  <strong>⚠️ Bắt buộc:</strong> Vui lòng tìm kiếm và chọn bệnh nhân từ hệ thống trước khi đăng ký khuôn mặt.
                </div>
              )}

              {registering && registerProgress.total > 1 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Đang tải ảnh...</span>
                    <span>{registerProgress.current}/{registerProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-slate-800 h-2 rounded-full transition-all"
                      style={{ width: `${(registerProgress.current / registerProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {registerResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  registerResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {registerResult.success ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <p className="text-sm">{registerResult.message}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                onClick={closeRegisterModal}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={handleRegister}
                disabled={registering || !selectedPatient}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {registerProgress.total > 1
                      ? `Đang xử lý ${registerProgress.current}/${registerProgress.total}...`
                      : 'Đang xử lý...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Đăng ký {selectedFiles.length > 1 ? `(${selectedFiles.length} ảnh)` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Detail Modal */}
      {showPatientDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPatientDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Thông tin bệnh nhân</h3>
              <button
                onClick={() => setShowPatientDetail(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              {loadingPatientDetail ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : patientDetail ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-slate-800">{patientDetail.tenBenhNhan}</h4>
                      <p className="text-sm text-slate-500">MAYTE: {patientDetail.maYTe}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {patientDetail.gioiTinh && (
                      <div>
                        <p className="text-sm text-slate-500">Giới tính</p>
                        <p className="font-medium text-slate-800">{patientDetail.gioiTinh}</p>
                      </div>
                    )}
                    {patientDetail.tuoi !== undefined && (
                      <div>
                        <p className="text-sm text-slate-500">Tuổi</p>
                        <p className="font-medium text-slate-800">{patientDetail.tuoi} tuổi</p>
                      </div>
                    )}
                    {patientDetail.soDienThoai && (
                      <div>
                        <p className="text-sm text-slate-500">Số điện thoại</p>
                        <p className="font-medium text-slate-800">{patientDetail.soDienThoai}</p>
                      </div>
                    )}
                    {patientDetail.diaChi && (
                      <div className="col-span-2">
                        <p className="text-sm text-slate-500">Địa chỉ</p>
                        <p className="font-medium text-slate-800">{patientDetail.diaChi}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Không tìm thấy thông tin bệnh nhân</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal (for Identify tab) */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Lịch sử nhận diện hôm nay
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {recentDetections.map((record) => (
                <div
                  key={record.id}
                  className={`p-4 rounded-xl flex items-center gap-4 transition-colors ${
                    latestDetection?.id === record.id
                      ? 'bg-blue-600/20 border border-blue-500/50'
                      : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 font-bold">
                    {record.patientName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{record.patientName}</p>
                    <p className="text-slate-400 text-sm">{record.maYTe}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-300 text-sm font-mono">{formatDate(record.detectedAt)}</p>
                    <p className={`text-xs font-medium ${
                      record.confidence >= 0.8 ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {(record.confidence * 100).toFixed(0)}% độ chính xác
                    </p>
                  </div>
                </div>
              ))}

              {recentDetections.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Chưa có lượt nhận diện nào hôm nay</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-700">
              <p className="text-center text-slate-400 text-sm">
                Chỉ hiển thị các kết quả có độ chính xác ≥ 80%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceManagementPage;
