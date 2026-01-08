// ==================== BỆNH NHÂN ====================
// BenhNhan từ bảng TT_BENHNHAN
export interface BenhNhan {
  benhNhanId: number;
  maYTe: string;
  fid?: string;
  soVaoVien: string;
  tenBenhNhan: string;
  ho?: string;
  ten?: string;
  gioiTinh?: number; // 1: Nam, 2: Nữ
  ngaySinh?: string;
  ngayGioSinh?: string;
  namSinh?: number;
  soDienThoai?: string;
  soNha?: string;
  diaChi?: string;
  diaChiThuongTru?: string;
  diaChiLienLac?: string;
  cmnd?: string;
  hoChieu?: string;
  email?: string;
  hinhAnhDaiDien?: string;
  nhomMauId?: number;
  tienSuDiUng?: string;
  tienSuBenh?: string;
  active?: string;
  benhVienId?: string;
  ngayTao?: string;
  ngayCapNhat?: string;
  ghiChu?: string;
  tinhThanhId?: string;
  quanHuyenId?: string;
  xaPhuongId?: string;
  ngheNghiepId?: number;
  quocTichId?: number;
  danTocId?: number;
}

// Patient info DTO (simplified)
export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  photoUrl?: string;
  currentAppointment?: AppointmentInfo;
  upcomingAppointments: AppointmentInfo[];
}

export interface AppointmentInfo {
  id: number;
  appointmentTime: string;
  queueNumber: number;
  status: string;
  roomId: string;
  roomName: string;
  floor: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  notes?: string;
}

// ==================== CẢNH BÁO TÉ NGÃ ====================
export interface FallAlert {
  id: number;
  patientId?: string;
  patientName?: string;
  timestamp: string;
  location?: string;
  confidence: number;
  status: 'Active' | 'Acknowledged' | 'Resolved' | 'FalsePositive';
  hasImage: boolean;
  frameData?: string;
}

// ==================== SỰ KIỆN PHÁT HIỆN ====================
export interface DetectionEvent {
  patientId: string;
  patientName: string;
  timestamp: string;
  location?: string;
  confidence?: number;
  eventType?: string;
}

// ==================== DASHBOARD ====================
export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  activeAlerts: number;
  patientsDetectedToday: number;
  recentAlerts: RecentAlert[];
  recentDetections: RecentDetection[];
}

export interface RecentAlert {
  id: number;
  patientName?: string;
  timestamp: string;
  location?: string;
  status: string;
}

export interface RecentDetection {
  patientId: string;
  patientName: string;
  timestamp: string;
  location?: string;
  confidence?: number;  // Độ chính xác nhận diện
}

// ==================== CAMERA ====================
export interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'error';
  streamUrl?: string;
  aiEnabled: boolean;
  fallDetectionEnabled: boolean;
  faceRecognitionEnabled: boolean;
  lastActivity?: string;
}

// ==================== SYSTEM ====================
export interface SystemStatus {
  status: string;
  timestamp: string;
  version: string;
  services: {
    database: string;
    signalR: string;
    aiModule: string;
  };
}

// ==================== NAVIGATION ====================
export type PageType = 
  | 'dashboard' 
  | 'patients' 
  | 'fall-detection' 
  | 'face-recognition'
  | 'face-identify'
  | 'cameras' 
  | 'settings';

export interface NavItem {
  id: PageType;
  label: string;
  icon: string;
}

// ==================== PAGINATION ====================
export interface PaginationParams {
  page: number;
  pageSize: number;
  total?: number;
}

// ==================== FILTERS ====================
export interface PatientFilter {
  search?: string;
  gioiTinh?: number;
  namSinhFrom?: number;
  namSinhTo?: number;
}

export interface AlertFilter {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  location?: string;
}
