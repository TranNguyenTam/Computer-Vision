import axios from 'axios';
import { BenhNhan, DashboardStats, FallAlert, Patient, SystemStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response type for paginated data
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// ==================== BỆNH NHÂN API ====================
export const benhNhanApi = {
  // Lấy danh sách bệnh nhân (phân trang)
  getAll: async (page = 1, count = 50): Promise<PaginatedResponse<BenhNhan>> => {
    const response = await api.get('/benhnhan', { params: { page, count } });
    return response.data;
  },

  // Lấy thông tin bệnh nhân theo ID
  getById: async (id: number): Promise<BenhNhan> => {
    const response = await api.get(`/benhnhan/${id}`);
    return response.data;
  },

  // Tìm kiếm bệnh nhân
  search: async (query: string): Promise<BenhNhan[]> => {
    const response = await api.get('/benhnhan/search', { params: { q: query } });
    return response.data;
  },

  // Lấy schema bảng
  getSchema: async (): Promise<unknown> => {
    const response = await api.get('/benhnhan/schema');
    return response.data;
  },
};

// ==================== PATIENT API (DTO) ====================
export const patientApi = {
  getPatientInfo: async (patientId: string): Promise<Patient> => {
    const response = await api.get(`/patient/${patientId}`);
    return response.data;
  },

  getAllPatients: async (): Promise<BenhNhan[]> => {
    const response = await api.get('/patient');
    return response.data;
  },

  searchPatients: async (query: string): Promise<BenhNhan[]> => {
    const response = await api.get('/patient/search', { params: { q: query } });
    return response.data;
  },

  // Báo cáo phát hiện bệnh nhân
  reportDetected: async (patientId: string, location: string, confidence: number): Promise<void> => {
    await api.post('/patient/detected', { patientId, location, confidence });
  },
};

// ==================== ALERT API ====================
export const alertApi = {
  // Lấy cảnh báo đang hoạt động
  getActiveAlerts: async (): Promise<FallAlert[]> => {
    const response = await api.get('/alerts/active');
    return response.data.data || response.data; // Support both ApiResponse and direct array
  },

  // Lấy tất cả cảnh báo (phân trang)
  getAllAlerts: async (page = 1, pageSize = 20): Promise<FallAlert[]> => {
    const response = await api.get('/alerts', { params: { page, pageSize } });
    return response.data.data || response.data; // Support both formats
  },

  // Lấy chi tiết cảnh báo
  getAlert: async (alertId: number): Promise<FallAlert> => {
    const response = await api.get(`/alerts/${alertId}`);
    return response.data.data || response.data; // Support both formats
  },

  // Tạo cảnh báo té ngã mới
  createFallAlert: async (data: {
    patientId?: string;
    location: string;
    confidence: number;
    frameData?: string;
  }): Promise<FallAlert> => {
    const response = await api.post('/fall-alert', data);
    return response.data.data || response.data; // Support both formats
  },

  // Xác nhận cảnh báo
  acknowledgeAlert: async (alertId: number, acknowledgedBy: string): Promise<void> => {
    await api.post(`/alerts/${alertId}/acknowledge`, { acknowledgedBy });
  },

  // Giải quyết cảnh báo
  resolveAlert: async (alertId: number, resolvedBy: string, notes?: string): Promise<void> => {
    await api.post(`/alerts/${alertId}/resolve`, { resolvedBy, notes });
  },

  // Đánh dấu cảnh báo sai
  markAsFalsePositive: async (alertId: number, markedBy: string): Promise<void> => {
    await api.put(`/alerts/${alertId}/status`, { 
      status: 'FalsePositive', 
      resolvedBy: markedBy 
    });
  },

  // Cập nhật trạng thái cảnh báo
  updateStatus: async (alertId: number, status: string, resolvedBy?: string, notes?: string): Promise<void> => {
    await api.put(`/alerts/${alertId}/status`, { status, resolvedBy, notes });
  },
};

// ==================== DASHBOARD API ====================
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  getStatus: async (): Promise<SystemStatus> => {
    const response = await api.get('/dashboard/status');
    return response.data;
  },
};

// ==================== AI MODULE API ====================
export const aiApi = {
  // Kiểm tra trạng thái AI module
  getStatus: async (): Promise<{ status: string; models: string[] }> => {
    try {
      const response = await axios.get('http://localhost:8000/health');
      return response.data;
    } catch {
      return { status: 'offline', models: [] };
    }
  },

  // Nhận diện khuôn mặt
  recognizeFace: async (imageData: string): Promise<{ patientId?: string; confidence: number }> => {
    const response = await axios.post('http://localhost:8000/recognize', { image: imageData });
    return response.data;
  },
};

export default api;
