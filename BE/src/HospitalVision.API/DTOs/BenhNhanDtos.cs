namespace HospitalVision.API.DTOs;

// =====================================================
// DTOs cho BenhNhan (Patient)
// =====================================================

/// <summary>
/// Thông tin cơ bản bệnh nhân
/// </summary>
public class BenhNhanDto
{
    public int BenhNhanId { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string? TenBenhNhan { get; set; }
    public string? GioiTinhText { get; set; }
    public int? Tuoi { get; set; }
    public DateTime? NgaySinh { get; set; }
    public string? SoDienThoai { get; set; }
    public string? DiaChi { get; set; }
    public string? HinhAnhDaiDien { get; set; }
}


public class BenhNhanDetailDto
{
    // Thông tin định danh
    public int BenhNhanId { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string? FID { get; set; }
    public string? SoVaoVien { get; set; }
    public string? PID { get; set; }
    
    // Thông tin cá nhân
    public string? TenBenhNhan { get; set; }
    public string? Ho { get; set; }
    public string? Ten { get; set; }
    public string? GioiTinhText { get; set; }
    public int? Tuoi { get; set; }
    public DateTime? NgaySinh { get; set; }
    public DateTime? NgayGioSinh { get; set; }
    public short? NamSinh { get; set; }
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
    
    // Giấy tờ tùy thân
    public string? CMND { get; set; }
    public string? HoChieu { get; set; }
    
    // Thông tin y tế
    public int? NhomMauId { get; set; }
    public int? YeuToRhId { get; set; }
    public string? TienSuDiUng { get; set; }
    public string? TienSuBenh { get; set; }
    public string? TienSuHutThuocLa { get; set; }
    public string? SoLuuTruNoiTru { get; set; }
    public string? SoLuuTruNgoaiTru { get; set; }
    
    // Người liên hệ
    public string? NguoiLienHe { get; set; }
    public string? ThongTinNguoiLienHe { get; set; }
    
    // Thông tin hệ thống
    public string? HinhAnhDaiDien { get; set; }
    public string? GhiChu { get; set; }
    public string? Active { get; set; }
    public DateTime? NgayTao { get; set; }
    public DateTime? NgayCapNhat { get; set; }
}

/// <summary>
/// Kết quả tìm kiếm bệnh nhân
/// </summary>
public class BenhNhanSearchResultDto
{
    public int BenhNhanId { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string? TenBenhNhan { get; set; }
    public string? GioiTinhText { get; set; }
    public int? Tuoi { get; set; }
    public string? SoDienThoai { get; set; }
    public bool HasFaceEncoding { get; set; }
}

// NOTE: DashboardStatsDto, RecentAlertDto, RecentDetectionDto, AppointmentInfoDto 
// are defined in AlertDtos.cs to avoid duplication

// =====================================================
// DTOs cho Hàng đợi
// =====================================================

/// <summary>
/// Thông tin bệnh nhân trong hàng đợi
/// </summary>
public class HangDoiPatientDto
{
    public int HangDoiPhongBanId { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string? TenBenhNhan { get; set; }
    public DateTime? NgaySinh { get; set; }
    public string? GioiTinhText { get; set; }
    public string? SoDienThoai { get; set; }
    public int? STT { get; set; }
    public string? TinhTrangText { get; set; }
    public DateTime? NgayGioLaySo { get; set; }
}
