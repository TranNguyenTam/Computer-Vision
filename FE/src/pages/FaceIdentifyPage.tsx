import {
    AlertCircle,
    Camera,
    CheckCircle2,
    Loader2,
    RefreshCw,
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
  fid?: string;
  soVaoVien?: string;
  pid?: string;
  tenBenhNhan: string;
  ho?: string;
  ten?: string;
  gioiTinh?: string;
  tuoi?: number;
  ngaySinh?: string;
  ngayGioSinh?: string;
  namSinh?: number;
  maNoiSinh?: string;
  soDienThoai?: string;
  dienThoaiBan?: string;
  email?: string;
  soNha?: string;
  diaChi?: string;
  diaChiThuongTru?: string;
  diaChiLienLac?: string;
  diaChiCoQuan?: string;
  tinhThanhId?: number;
  quanHuyenId?: number;
  xaPhuongId?: string;
  cmnd?: string;
  hoChieu?: string;
  nhomMau?: string;
  yeuToRh?: string;
  tienSuDiUng?: string;
  tienSuBenh?: string;
  tienSuHutThuocLa?: string;
  soLuuTruNoiTru?: string;
  soLuuTruNgoaiTru?: string;
  ngheNghiepId?: number;
  quocTichId?: number;
  danTocId?: number;
  trinhDoVanHoaId?: number;
  tinhTrangHonNhanId?: number;
  vietKieu?: boolean;
  nguoiNuocNgoai?: boolean;
  nguoiLienHe?: string;
  thongTinNguoiLienHe?: string;
  moiQuanHeId?: number;
  tuVong?: boolean;
  ngayTuVong?: string;
  thoiGianTuVong?: string;
  nguyenNhanTuVongId?: number;
  hinhAnhDaiDien?: string;
  ghiChu?: string;
  active?: boolean;
  benhVienId?: number;
  siteId?: number;
  ngayTao?: string;
  ngayCapNhat?: string;
  nguoiTaoId?: number;
  nguoiCapNhatId?: number;
}

// Helper function để hiển thị giá trị hoặc "Chưa cập nhật"
const displayValue = (value: string | number | boolean | null | undefined, suffix?: string): string => {
  if (value === null || value === undefined || value === '') {
    return 'Chưa cập nhật';
  }
  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }
  return suffix ? `${value}${suffix}` : String(value);
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Chưa cập nhật';
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN');
  } catch {
    return 'Chưa cập nhật';
  }
};

interface RecognizedFace {
  recognized: boolean;
  confidence: number;
  person_id?: string;  // MAYTE
  person_name?: string;
  bbox?: number[];
}

interface IdentifyResult {
  success: boolean;
  total_faces: number;
  recognized_count: number;
  faces: RecognizedFace[];
  snapshot: string;  // base64
}

const FaceIdentifyPage: React.FC = () => {
  const [serverOnline, setServerOnline] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  
  // Kết quả nhận diện
  const [identifyResult, setIdentifyResult] = useState<IdentifyResult | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Kiểm tra server
  const checkServer = useCallback(async () => {
    try {
      const response = await fetch(`${CAMERA_SERVER_URL}/api/camera/status`);
      setServerOnline(response.ok);
    } catch {
      setServerOnline(false);
    }
  }, []);

  useEffect(() => {
    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, [checkServer]);

  // Nhận diện khuôn mặt từ camera
  const handleIdentify = async () => {
    setIdentifying(true);
    setError(null);
    setIdentifyResult(null);
    setPatientInfo(null);

    try {
      // Gọi API nhận diện từ camera
      const response = await fetch(`${CAMERA_SERVER_URL}/api/faces/identify-from-camera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Không thể kết nối AI Server');
      }

      const result: IdentifyResult = await response.json();
      setIdentifyResult(result);

      // Nếu nhận diện được, lấy thông tin bệnh nhân từ Backend
      if (result.success && result.recognized_count > 0) {
        const recognizedFace = result.faces.find(f => f.recognized);
        if (recognizedFace?.person_id) {
          await fetchPatientInfo(recognizedFace.person_id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIdentifying(false);
    }
  };

  // Lấy thông tin bệnh nhân từ Backend bằng MAYTE
  const fetchPatientInfo = async (maYTe: string) => {
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
    }
  };

  // Reset
  const handleReset = () => {
    setIdentifyResult(null);
    setPatientInfo(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Scan className="w-8 h-8 text-blue-600" />
            Nhận diện khuôn mặt
          </h1>
          <p className="text-slate-500 mt-2">
            Chụp ảnh từ camera và nhận diện bệnh nhân
          </p>
        </div>

        {/* Server Status */}
        <div className="mb-6 flex items-center gap-4">
          <span className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            serverOnline 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`}></span>
            {serverOnline ? 'Camera Server đang hoạt động' : 'Camera Server không kết nối'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Camera View & Identify Button */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Camera trực tiếp
              </h2>
            </div>
            
            <div className="relative">
              {/* Camera Stream */}
              {serverOnline ? (
                <img
                  src={`${CAMERA_SERVER_URL}/api/stream`}
                  alt="Camera Stream"
                  className="w-full aspect-video object-cover bg-slate-900"
                />
              ) : (
                <div className="w-full aspect-video bg-slate-900 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Camera không khả dụng</p>
                  </div>
                </div>
              )}

              {/* Overlay khi đang nhận diện */}
              {identifying && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
                    <p className="text-lg font-medium">Đang nhận diện...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Identify Button */}
            <div className="p-6">
              <button
                onClick={handleIdentify}
                disabled={!serverOnline || identifying}
                className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
                  serverOnline && !identifying
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {identifying ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <Scan className="w-6 h-6" />
                    Nhận diện ngay
                  </>
                )}
              </button>

              {identifyResult && (
                <button
                  onClick={handleReset}
                  className="w-full mt-3 py-3 rounded-xl font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Nhận diện lại
                </button>
              )}
            </div>
          </div>

          {/* Result Panel */}
          <div className="space-y-6">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-800">Lỗi nhận diện</h3>
                    <p className="text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Kết quả nhận diện */}
            {identifyResult && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-4 border-b bg-slate-50">
                  <h2 className="font-semibold text-slate-700">Kết quả nhận diện</h2>
                </div>

                {/* Snapshot */}
                {identifyResult.snapshot && (
                  <div className="p-4 border-b">
                    <img
                      src={`data:image/jpeg;base64,${identifyResult.snapshot}`}
                      alt="Snapshot"
                      className="w-full rounded-xl"
                    />
                  </div>
                )}

                <div className="p-6">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-slate-800">
                        {identifyResult.total_faces}
                      </div>
                      <div className="text-sm text-slate-500">Khuôn mặt phát hiện</div>
                    </div>
                    <div className={`rounded-xl p-4 text-center ${
                      identifyResult.recognized_count > 0 
                        ? 'bg-emerald-50' 
                        : 'bg-amber-50'
                    }`}>
                      <div className={`text-3xl font-bold ${
                        identifyResult.recognized_count > 0 
                          ? 'text-emerald-600' 
                          : 'text-amber-600'
                      }`}>
                        {identifyResult.recognized_count}
                      </div>
                      <div className={`text-sm ${
                        identifyResult.recognized_count > 0 
                          ? 'text-emerald-600' 
                          : 'text-amber-600'
                      }`}>Đã nhận diện</div>
                    </div>
                  </div>

                  {/* No face detected */}
                  {identifyResult.total_faces === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Không phát hiện khuôn mặt nào</p>
                      <p className="text-sm mt-1">Hãy đảm bảo khuôn mặt nằm trong khung hình</p>
                    </div>
                  )}

                  {/* Face detected but not recognized */}
                  {identifyResult.total_faces > 0 && identifyResult.recognized_count === 0 && (
                    <div className="text-center py-8 text-amber-500">
                      <AlertCircle className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-lg font-medium">Không nhận diện được</p>
                      <p className="text-sm mt-1 text-slate-500">
                        Khuôn mặt chưa được đăng ký trong hệ thống
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Thông tin bệnh nhân */}
            {patientInfo && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-emerald-200">
                <div className="p-4 border-b bg-emerald-50">
                  <h2 className="font-semibold text-emerald-700 flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Thông tin bệnh nhân
                  </h2>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  {/* Header với tên và ảnh */}
                  <div className="flex items-start gap-6 mb-6">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-12 h-12 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-500">Họ và tên</div>
                      <div className="text-xl font-bold text-slate-800 mb-2">
                        {patientInfo.tenBenhNhan || 'Chưa cập nhật'}
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <div className="text-xs text-slate-400">Mã y tế</div>
                          <div className="font-semibold text-blue-600">{patientInfo.maYTe}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Giới tính</div>
                          <div className="font-medium text-slate-700">{displayValue(patientInfo.gioiTinh)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN ĐỊNH DANH */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      🆔 Thông tin định danh
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <div className="text-xs text-slate-400">Mã bệnh nhân (ID)</div>
                        <div className="font-medium text-slate-700">{patientInfo.benhNhanId}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">FID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.fid)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">PID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.pid)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Số vào viện</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.soVaoVien)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Số lưu trữ nội trú</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.soLuuTruNoiTru)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Số lưu trữ ngoại trú</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.soLuuTruNgoaiTru)}</div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN CÁ NHÂN */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      👤 Thông tin cá nhân
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <div className="text-xs text-slate-400">Họ</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.ho)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Tên</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.ten)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Ngày sinh</div>
                        <div className="font-medium text-slate-700">
                          {patientInfo.ngaySinh ? formatDate(patientInfo.ngaySinh) : displayValue(patientInfo.namSinh)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Tuổi</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.tuoi, ' tuổi')}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Năm sinh</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.namSinh)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Mã nơi sinh</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.maNoiSinh)}</div>
                      </div>
                    </div>
                  </div>

                  {/* GIẤY TỜ TÙY THÂN */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      📄 Giấy tờ tùy thân
                    </h3>
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <div className="text-xs text-slate-400">CMND/CCCD</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.cmnd)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Hộ chiếu</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.hoChieu)}</div>
                      </div>
                    </div>
                  </div>

                  {/* LIÊN HỆ */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      📞 Thông tin liên hệ
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <div className="text-xs text-slate-400">Số điện thoại</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.soDienThoai)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Điện thoại bàn</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.dienThoaiBan)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Email</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.email)}</div>
                      </div>
                    </div>
                  </div>

                  {/* ĐỊA CHỈ */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      🏠 Địa chỉ
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-3 rounded-lg">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-slate-400">Số nhà</div>
                          <div className="font-medium text-slate-700">{displayValue(patientInfo.soNha)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Địa chỉ</div>
                          <div className="font-medium text-slate-700">{displayValue(patientInfo.diaChi)}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Địa chỉ thường trú</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.diaChiThuongTru)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Địa chỉ liên lạc</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.diaChiLienLac)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Địa chỉ cơ quan</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.diaChiCoQuan)}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-slate-400">Tỉnh/Thành ID</div>
                          <div className="font-medium text-slate-700">{displayValue(patientInfo.tinhThanhId)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Quận/Huyện ID</div>
                          <div className="font-medium text-slate-700">{displayValue(patientInfo.quanHuyenId)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Xã/Phường ID</div>
                          <div className="font-medium text-slate-700">{displayValue(patientInfo.xaPhuongId)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN NHÂN KHẨU HỌC */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      📊 Thông tin nhân khẩu học
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <div className="text-xs text-slate-400">Nghề nghiệp ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.ngheNghiepId)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Quốc tịch ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.quocTichId)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Dân tộc ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.danTocId)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Trình độ văn hóa ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.trinhDoVanHoaId)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Tình trạng hôn nhân ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.tinhTrangHonNhanId)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Việt Kiều</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.vietKieu)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Người nước ngoài</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.nguoiNuocNgoai)}</div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN Y TẾ */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      🏥 Thông tin y tế
                    </h3>
                    <div className="space-y-3 bg-slate-50 p-3 rounded-lg">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-slate-400">Nhóm máu</div>
                          <div className="font-medium text-slate-700">{displayValue(patientInfo.nhomMau)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Yếu tố Rh</div>
                          <div className="font-medium text-slate-700">{displayValue(patientInfo.yeuToRh)}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-red-400 font-medium">⚠️ Tiền sử dị ứng</div>
                        <div className={`font-medium p-2 rounded mt-1 ${patientInfo.tienSuDiUng ? 'text-red-700 bg-red-50' : 'text-slate-500'}`}>
                          {displayValue(patientInfo.tienSuDiUng)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-amber-500 font-medium">📋 Tiền sử bệnh</div>
                        <div className={`font-medium p-2 rounded mt-1 ${patientInfo.tienSuBenh ? 'text-slate-700 bg-amber-50' : 'text-slate-500'}`}>
                          {displayValue(patientInfo.tienSuBenh)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-orange-500 font-medium">🚬 Tiền sử hút thuốc lá</div>
                        <div className={`font-medium p-2 rounded mt-1 ${patientInfo.tienSuHutThuocLa ? 'text-slate-700 bg-orange-50' : 'text-slate-500'}`}>
                          {displayValue(patientInfo.tienSuHutThuocLa)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NGƯỜI LIÊN HỆ */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      👥 Người liên hệ
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <div className="text-xs text-slate-400">Người liên hệ</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.nguoiLienHe)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Thông tin người liên hệ</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.thongTinNguoiLienHe)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Mối quan hệ ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.moiQuanHeId)}</div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN TỬ VONG */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      ⚰️ Thông tin tử vong
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <div className="text-xs text-slate-400">Tử vong</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.tuVong)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Ngày tử vong</div>
                        <div className="font-medium text-slate-700">{formatDate(patientInfo.ngayTuVong)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Thời gian tử vong</div>
                        <div className="font-medium text-slate-700">{formatDate(patientInfo.thoiGianTuVong)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Nguyên nhân tử vong ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.nguyenNhanTuVongId)}</div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN HỆ THỐNG */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      ⚙️ Thông tin hệ thống
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg">
                      <div>
                        <div className="text-xs text-slate-400">Trạng thái</div>
                        <div className="font-medium text-slate-700">{patientInfo.active ? 'Hoạt động' : 'Không hoạt động'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Bệnh viện ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.benhVienId)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Site ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.siteId)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Ngày tạo</div>
                        <div className="font-medium text-slate-700">{formatDate(patientInfo.ngayTao)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Ngày cập nhật</div>
                        <div className="font-medium text-slate-700">{formatDate(patientInfo.ngayCapNhat)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Người tạo ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.nguoiTaoId)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Người cập nhật ID</div>
                        <div className="font-medium text-slate-700">{displayValue(patientInfo.nguoiCapNhatId)}</div>
                      </div>
                    </div>
                  </div>

                  {/* GHI CHÚ */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                      📝 Ghi chú
                    </h3>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <div className="font-medium text-slate-600 italic">
                        {displayValue(patientInfo.ghiChu)}
                      </div>
                    </div>
                  </div>

                  {/* Confidence */}
                  {identifyResult?.faces.find(f => f.recognized) && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Độ tin cậy nhận diện</span>
                        <span className="font-semibold text-emerald-600">
                          {((identifyResult.faces.find(f => f.recognized)?.confidence || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ 
                            width: `${(identifyResult.faces.find(f => f.recognized)?.confidence || 0) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Success indicator */}
                <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Nhận diện thành công!</span>
                  </div>
                </div>
              </div>
            )}

            {/* Hướng dẫn khi chưa nhận diện */}
            {!identifyResult && !error && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                <h3 className="font-semibold text-blue-800 mb-3">Hướng dẫn sử dụng</h3>
                <ul className="space-y-2 text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-sm font-medium flex-shrink-0">1</span>
                    <span>Đảm bảo khuôn mặt nằm trong khung camera</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-sm font-medium flex-shrink-0">2</span>
                    <span>Nhấn nút "Nhận diện ngay" để chụp và phân tích</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-sm font-medium flex-shrink-0">3</span>
                    <span>Thông tin bệnh nhân sẽ hiển thị nếu đã đăng ký</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceIdentifyPage;
