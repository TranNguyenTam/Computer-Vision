import {
    AlertCircle,
    Camera,
    Check,
    CheckCircle2,
    Image as ImageIcon,
    Info,
    Loader2,
    Plus,
    RefreshCw,
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

const CAMERA_SERVER_URL = 'http://localhost:8080';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface RegisteredFace {
  person_id: string;  // MAYTE - Mã y tế
  person_name: string;
  person_type: 'patient';  // Chỉ dùng cho bệnh nhân
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
  tenBenhNhan: string;  // Họ tên bệnh nhân từ TT_BENHNHAN
  gioiTinh?: string;
  tuoi?: number;
  soDienThoai?: string;
  diaChi?: string;
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

const FaceRecognitionPage: React.FC = () => {
  const [faces, setFaces] = useState<RegisteredFace[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detection history
  const [detectionsToday, setDetectionsToday] = useState<DetectionRecord[]>([]);
  const [loadingDetections, setLoadingDetections] = useState(false);
  
  // Registration modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerMode, setRegisterMode] = useState<'camera' | 'upload'>('camera');
  const [registerData, setRegisterData] = useState({
    person_id: '',  // MAYTE
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

  // Fetch detections today
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
    } catch {
      // Ignore
    } finally {
      setLoadingDetections(false);
    }
  }, []);

  // Fetch registered faces
  const fetchFaces = useCallback(async () => {
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/faces`);
      if (response.ok) {
        const data = await response.json();
        // Map server response to expected format
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

  // Fetch settings
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
    
    // Refresh detections every 30 seconds
    const interval = setInterval(fetchDetectionsToday, 30000);
    return () => clearInterval(interval);
  }, [fetchFaces, fetchSettings, fetchDetectionsToday]);

  // Search patients from database
  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults({ patients: [], loading: false });
      return;
    }

    setSearchResults(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch(`${API_BASE_URL}/face/search-patient?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const patients = await response.json();
        setSearchResults({ patients, loading: false });
      } else {
        setSearchResults({ patients: [], loading: false });
      }
    } catch {
      setSearchResults({ patients: [], loading: false });
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearch) {
        searchPatients(patientSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearch, searchPatients]);

  // Select patient from search results
  const handleSelectPatient = (patient: PatientInfo) => {
    setSelectedPatient(patient);
    setRegisterData({
      person_id: patient.maYTe,
      person_name: patient.tenBenhNhan
    });
    setPatientSearch('');
    setSearchResults({ patients: [], loading: false });
  };

  // Toggle face recognition
  const toggleFaceRecognition = async () => {
    if (!settings) return;
    
    try {
      const newValue = !settings.face_recognition_enabled;
      const response = await fetch(`${CAMERA_SERVER_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ face_recognition_enabled: newValue }),
      });
      
      if (response.ok) {
        setSettings({ ...settings, face_recognition_enabled: newValue });
      }
    } catch (error) {
      console.error('Failed to toggle face recognition:', error);
    }
  };

  // Register face - hỗ trợ nhiều ảnh
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
      if (registerMode === 'camera') {
        // Register from current camera frame
        const response = await fetch(`${CAMERA_SERVER_URL}/api/faces/register-from-camera`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person_id: registerData.person_id,
            person_name: registerData.person_name,
            person_type: 'patient'  // Luôn là patient
          }),
        });
        
        const result = await response.json();
        if (result.success) {
          setRegisterResult({ success: true, message: result.message || 'Đăng ký thành công!' });
          fetchFaces();
          setTimeout(() => {
            closeRegisterModal();
          }, 1500);
        } else {
          setRegisterResult({ success: false, message: result.error || 'Đăng ký thất bại' });
        }
      } else {
        // Register from uploaded images - nhiều ảnh
        if (selectedFiles.length === 0) {
          setRegisterResult({ success: false, message: 'Vui lòng chọn ít nhất 1 ảnh' });
          setRegistering(false);
          return;
        }

        setRegisterProgress({ current: 0, total: selectedFiles.length });
        let successCount = 0;
        let lastError = '';

        // Upload từng ảnh một
        for (let i = 0; i < selectedFiles.length; i++) {
          setRegisterProgress({ current: i + 1, total: selectedFiles.length });
          
          const formData = new FormData();
          formData.append('person_id', registerData.person_id);
          formData.append('person_name', registerData.person_name);
          formData.append('person_type', 'patient');  // Luôn là patient
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
      }
    } catch (error) {
      setRegisterResult({ success: false, message: 'Không thể kết nối server' });
    } finally {
      setRegistering(false);
    }
  };

  // Close register modal and reset state
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

  // Delete face
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

  // Filter faces
  const filteredFaces = faces.filter(face =>
    (face.person_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (face.person_id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Nhận dạng khuôn mặt</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý và đăng ký khuôn mặt bệnh nhân</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Server status */}
          <span className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
            serverOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            {serverOnline ? 'Server kết nối' : 'Server ngắt kết nối'}
          </span>
          
          {/* Toggle Face Recognition */}
          <button
            onClick={toggleFaceRecognition}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              settings?.face_recognition_enabled
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            {settings?.face_recognition_enabled ? 'Đang bật' : 'Đang tắt'}
          </button>
          
          {/* Register button */}
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Đăng ký mới
          </button>
        </div>
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
              <Camera className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-800">
                {settings?.face_recognition_enabled ? 'Bật' : 'Tắt'}
              </p>
              <p className="text-sm text-slate-500">Trạng thái AI</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-amber-50 rounded-lg flex items-center justify-center">
              <Info className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">Mức độ nhận diện</p>
              <p className="text-xs text-slate-500">60-70%: Thấp | 70-80%: TB | &gt;80%: Cao</p>
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
              Nhận diện hôm nay ({detectionsToday.length})
            </h3>
            <button
              onClick={fetchDetectionsToday}
              disabled={loadingDetections}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDetections ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {detectionsToday.slice(0, 9).map((detection) => (
                <div key={detection.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
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

      {/* Search and List */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Search bar */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc mã..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all text-sm"
              />
            </div>
            <button
              onClick={fetchFaces}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
          </div>
        </div>

        {/* Faces list */}
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
            {filteredFaces.map((face) => (
              <div
                key={face.person_id}
                className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-all group"
              >
                {/* Face image */}
                <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-slate-200">
                  <img
                    src={`${CAMERA_SERVER_URL}/api/faces/${face.person_id}/image`}
                    alt={face.person_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <User className="w-12 h-12 text-slate-400" />
                  </div>
                  
                  {/* Image count badge */}
                  {face.image_count && face.image_count > 1 && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">
                      <ImageIcon className="w-3 h-3" />
                      {face.image_count}
                    </div>
                  )}
                  
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(face.person_id)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Info */}
                <div className="text-center">
                  <p className="font-medium text-slate-800 truncate">{face.person_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">MAYTE: {face.person_id}</p>
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Bệnh nhân
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-slate-800">Đăng ký khuôn mặt bệnh nhân</h3>
              <button
                onClick={closeRegisterModal}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              {/* Info note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <strong>💡 Lưu ý:</strong> Có thể đăng ký nhiều ảnh cho cùng một bệnh nhân (cùng MAYTE) 
                để tăng độ chính xác nhận dạng. Nên chụp từ nhiều góc khác nhau.
              </div>

              {/* Patient Search */}
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
                
                {/* Search results dropdown */}
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

              {/* Selected patient info */}
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
              
              {/* Mode selection */}
              <div className="flex gap-2">
                <button
                  onClick={() => setRegisterMode('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all ${
                    registerMode === 'camera'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Từ Camera
                </button>
                <button
                  onClick={() => setRegisterMode('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all ${
                    registerMode === 'upload'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Tải ảnh lên
                </button>
              </div>

              {/* Camera preview or upload */}
              {registerMode === 'camera' ? (
                <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative">
                  {/* Sử dụng raw stream không có AI overlay */}
                  <img
                    src={`${CAMERA_SERVER_URL}/api/stream/raw`}
                    alt="Camera preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
                    💡 Đảm bảo khuôn mặt rõ ràng, đủ sáng
                  </div>
                </div>
              ) : (
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
              )}

              {/* Hidden form fields (auto-filled from selected patient) */}
              {!selectedPatient && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  <strong>⚠️ Bắt buộc:</strong> Vui lòng tìm kiếm và chọn bệnh nhân từ hệ thống trước khi đăng ký khuôn mặt.
                </div>
              )}

              {/* Progress bar when uploading multiple images */}
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

              {/* Result message */}
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

            {/* Modal footer */}
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
    </div>
  );
};

export default FaceRecognitionPage;