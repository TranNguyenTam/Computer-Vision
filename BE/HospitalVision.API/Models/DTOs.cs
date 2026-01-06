namespace HospitalVision.API.Models.DTOs;

/// Patient information response DTO
public class PatientInfoDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    
    // Current/Next appointment info
    public AppointmentInfoDto? CurrentAppointment { get; set; }
    public List<AppointmentInfoDto> UpcomingAppointments { get; set; } = new();
}

/// Appointment information DTO
public class AppointmentInfoDto
{
    public int Id { get; set; }
    public DateTime AppointmentTime { get; set; }
    public int QueueNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string RoomName { get; set; } = string.Empty;
    public string Floor { get; set; } = string.Empty;
    public string DoctorId { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

/// Fall alert request DTO
public class FallAlertRequest
{
    public string? PatientId { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; } = 1.0;
    public string AlertType { get; set; } = "fall";
    public string? FrameData { get; set; }
}

/// Fall alert response DTO
public class FallAlertResponse
{
    public int Id { get; set; }
    public string? PatientId { get; set; }
    public string? PatientName { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool HasImage { get; set; }
    public string? FrameData { get; set; }  // Base64 encoded image
}

/// Patient detection event request DTO
public class PatientDetectedRequest
{
    public string PatientId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; } = 1.0;
    public string EventType { get; set; } = "patient_detected";
}

/// Update fall alert status request DTO
public class UpdateAlertStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? ResolvedBy { get; set; }
    public string? Notes { get; set; }
}

/// Dashboard statistics DTO
public class DashboardStatsDto
{
    public int TotalPatients { get; set; }
    public int TodayAppointments { get; set; }
    public int ActiveAlerts { get; set; }
    public int PatientsDetectedToday { get; set; }
    public List<FallAlertResponse> RecentAlerts { get; set; } = new();
    public List<RecentDetectionDto> RecentDetections { get; set; } = new();
}

/// Recent detection DTO for dashboard
public class RecentDetectionDto
{
    public string PatientId { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; }  // Độ chính xác nhận diện
}

// =====================================================
// DTOs cho AI Camera Server - Nhận diện tự động
// =====================================================

/// Request để lưu embedding khi đăng ký khuôn mặt
public class SaveEmbeddingRequest
{
    public string MaYTe { get; set; } = string.Empty;
    public float[] Embedding { get; set; } = Array.Empty<float>();
    public string? ImagePath { get; set; }
    public string? ModelName { get; set; } = "Facenet512";
}

/// Request để ghi nhận diện tự động
public class RecordDetectionRequest
{
    public string MaYTe { get; set; } = string.Empty;
    public string? PatientName { get; set; }
    public double Confidence { get; set; }
    public string? CameraId { get; set; }
    public string? Location { get; set; }
    public string? Note { get; set; }
}

/// Request đăng ký khuôn mặt từ AI Server
public class RegisterFaceRequest
{
    /// <summary>
    /// Mã y tế bệnh nhân (bắt buộc)
    /// </summary>
    public string MaYTe { get; set; } = string.Empty;
    
    /// <summary>
    /// Ảnh dạng base64 (JPEG/PNG)
    /// </summary>
    public string? ImageBase64 { get; set; }
    
    /// <summary>
    /// Content type của ảnh (image/jpeg, image/png)
    /// </summary>
    public string? ContentType { get; set; }
    
    /// <summary>
    /// Vector embedding đã tính từ AI (512 floats cho Facenet512)
    /// </summary>
    public float[]? Embedding { get; set; }
    
    /// <summary>
    /// Tên model sử dụng (Facenet512, VGGFace, etc.)
    /// </summary>
    public string? ModelName { get; set; }
    
    /// <summary>
    /// Ghi chú
    /// </summary>
    public string? Note { get; set; }
}

/// Response khi lấy embeddings
public class EmbeddingData
{
    public string MaYTe { get; set; } = string.Empty;
    public List<EmbeddingVector> Embeddings { get; set; } = new();
}

public class EmbeddingVector
{
    public int EmbeddingSize { get; set; }
    public string? ModelName { get; set; }
    public float[]? Vector { get; set; }
}

// =====================================================
// DTOs cho Face Service - Clean Architecture
// =====================================================

/// Face registration DTO
public class FaceRegistrationDto
{
    public string MaYTe { get; set; } = string.Empty;
    public string PersonName { get; set; } = string.Empty;
    public int ImageCount { get; set; }
}

/// Face detection DTO
public class FaceDetectionDto
{
    public int Id { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public DateTime? DetectedAt { get; set; }
    public string? CameraId { get; set; }
    public string? Location { get; set; }
}

/// Patient validation DTO
public class PatientValidationDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public PatientBasicInfo? Patient { get; set; }
}

/// Patient basic info DTO
public class PatientBasicInfo
{
    public int BenhNhanId { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string TenBenhNhan { get; set; } = string.Empty;
    public string? GioiTinh { get; set; }
    public int? Tuoi { get; set; }
    public string? NgaySinh { get; set; }
    public string? SoDienThoai { get; set; }
    public string? DiaChi { get; set; }
    public string? NhomMau { get; set; }
    public string? YeuToRh { get; set; }
    public string? TienSuBenh { get; set; }
    public string? HinhAnhDaiDien { get; set; }
    public string? BHYT { get; set; }
}

/// Patient detail DTO with full information (used by FaceController)
public class PatientDetailDto
{
    // Thông tin định danh
    public int BenhNhanId { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string? FID { get; set; }
    public string? SoVaoVien { get; set; }
    public string? PID { get; set; }
    
    // Thông tin cá nhân
    public string TenBenhNhan { get; set; } = string.Empty;
    public string? Ho { get; set; }
    public string? Ten { get; set; }
    public string? GioiTinh { get; set; }
    public int? Tuoi { get; set; }
    public string? NgaySinh { get; set; }
    public string? NgayGioSinh { get; set; }
    public string? NamSinh { get; set; }
    public string? MaNoiSinh { get; set; }
    
    // Liên hệ
    public string? SoDienThoai { get; set; }
    public string? DienThoaiBan { get; set; }
    public string? Email { get; set; }
    
    // Địa chỉ
    public string? SoNha { get; set; }
    public string? DiaChi { get; set; }
    public string? DiaChiThuongTru { get; set; }
    public string? DiaChiLienLac { get; set; }
    public string? DiaChiCoQuan { get; set; }
    public string? TinhThanhId { get; set; }
    public string? QuanHuyenId { get; set; }
    public string? XaPhuongId { get; set; }
    public string? QuocTich { get; set; }
    public string? DanToc { get; set; }
    public string? TonGiao { get; set; }
    public string? QuocGia { get; set; }
    
    // Giấy tờ tùy thân
    public string? CMND { get; set; }
    public string? HoChieu { get; set; }
    
    // Y tế
    public string? NhomMau { get; set; }
    public string? YeuToRh { get; set; }
    public string? TienSuBenh { get; set; }
    public string? TienSuGiaDinh { get; set; }
    public string? TienSuDiUng { get; set; }
    public string? TienSuHutThuocLa { get; set; }
    public string? DiUng { get; set; }
    public string? NhomDoiTuong { get; set; }
    public string? DoiTuong { get; set; }
    public string? LoaiDoiTuong { get; set; }
    public string? LoaiBenhNhan { get; set; }
    public string? TrangThai { get; set; }
    public string? SoLuuTruNoiTru { get; set; }
    public string? SoLuuTruNgoaiTru { get; set; }
    
    // BHYT
    public string? BHYT { get; set; }
    public string? SoTheBHYT { get; set; }
    public string? MaDKBD { get; set; }
    public string? MucHuong { get; set; }
    public string? TuNgay { get; set; }
    public string? DenNgay { get; set; }
    
    // Hình ảnh
    public string? HinhAnhDaiDien { get; set; }
    public string? UrlHinhAnh { get; set; }
    
    // Thông tin nội trú (nếu có)
    public string? MaGiuong { get; set; }
    public string? SoGiuong { get; set; }
    public string? MaPhong { get; set; }
    public string? TenPhong { get; set; }
    public string? MaKhoa { get; set; }
    public string? TenKhoa { get; set; }
    public string? KhoaDieuTri { get; set; }
    
    // Người liên hệ
    public string? NguoiLienHe { get; set; }
    public string? NguoiLienHeTen { get; set; }
    public string? NguoiLienHeSdt { get; set; }
    public string? NguoiLienHeDiaChi { get; set; }
    public string? NguoiLienHeQuanHe { get; set; }
    public string? ThongTinNguoiLienHe { get; set; }
    public string? MoiQuanHeId { get; set; }
    
    // Nghề nghiệp, học vấn
    public string? NgheNghiep { get; set; }
    public string? NgheNghiepId { get; set; }
    public string? NoiLamViec { get; set; }
    public string? ChucVu { get; set; }
    public string? HocVan { get; set; }
    public string? QuocTichId { get; set; }
    public string? DanTocId { get; set; }
    public string? TrinhDoVanHoaId { get; set; }
    public string? TinhTrangHonNhanId { get; set; }
    public bool? VietKieu { get; set; }
    public bool? NguoiNuocNgoai { get; set; }
    
    // Tử vong
    public bool? TuVong { get; set; }
    public DateTime? NgayTuVong { get; set; }
    public string? ThoiGianTuVong { get; set; }
    public string? NguyenNhanTuVongId { get; set; }
    
    // Metadata
    public string? CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? Note { get; set; }
    public string? GhiChu { get; set; }
    public bool? Active { get; set; }
    public int? BenhVienId { get; set; }
    public int? SiteId { get; set; }
    public DateTime? NgayTao { get; set; }
    public DateTime? NgayCapNhat { get; set; }
    public string? NguoiTaoId { get; set; }
    public string? NguoiCapNhatId { get; set; }
}

// =====================================================
// DTOs from FaceImage.cs (moved here for better organization)
// =====================================================

/// <summary>
/// Face image information with patient details
/// </summary>
public class FaceImageDto
{
    public int Id { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string ImagePath { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>
/// Face recognition result with patient information
/// </summary>
public class FaceRecognitionResult
{
    public bool Recognized { get; set; }
    public float Confidence { get; set; }
    public string ConfidenceLevel { get; set; } = string.Empty; // "low", "medium", "high", "very_high"
    public PatientBasicInfo? Patient { get; set; }
    public string? Message { get; set; }
    public bool IsInQueue { get; set; }  // Bệnh nhân có đang trong hàng đợi hôm nay không
}

/// <summary>
/// Patient information in queue (JOIN from HangDoiPhongBan and TT_BENHNHAN)
/// </summary>
public class HangDoiPatientInfo
{
    public int Id { get; set; }  // HangDoiPhongBan_Id
    public string MaYTe { get; set; } = string.Empty;
    public string HoTen { get; set; } = string.Empty;
    public DateTime? NgaySinh { get; set; }
    public string? GioiTinh { get; set; }
    public string? SoDienThoai { get; set; }
    public int? SoThuTu { get; set; }
    public string? TenPhong { get; set; }
    public string? TrangThaiText { get; set; }
}
