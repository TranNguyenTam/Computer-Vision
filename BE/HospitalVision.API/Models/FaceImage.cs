using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalVision.API.Models;

[Table("FACE_IMAGES")]
public class FaceImage
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }
    
    [Required]
    [Column("MAYTE")]
    [StringLength(50)]
    public string MaYTe { get; set; } = string.Empty;
    
    [Required]
    [Column("IMAGE_PATH")]
    [StringLength(500)]
    public string ImagePath { get; set; } = string.Empty;
    
    [Column("EMBEDDING")]
    public byte[]? Embedding { get; set; }
    
    [Column("EMBEDDING_SIZE")]
    public int? EmbeddingSize { get; set; }
    
    [Column("MODEL_NAME")]
    [StringLength(50)]
    public string? ModelName { get; set; }
    
    [Column("CREATED_AT")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    [Column("CREATED_BY")]
    [StringLength(100)]
    public string? CreatedBy { get; set; }
    
    [Column("IS_ACTIVE")]
    public bool IsActive { get; set; } = true;
    
    [Column("NOTE")]
    [StringLength(500)]
    public string? Note { get; set; }
    
    // Navigation property (không join trực tiếp vì dùng MAYTE không phải FK)
    [NotMapped]
    public BenhNhan? BenhNhan { get; set; }
}

/// DTO để trả về thông tin face image kèm thông tin bệnh nhân
public class FaceImageDto
{
    public int Id { get; set; }
    public string MaYTe { get; set; } = string.Empty;
    public string ImagePath { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
    
    // Thông tin bệnh nhân từ TT_BENHNHAN
    public PatientBasicInfo? Patient { get; set; }
}

/// Thông tin đầy đủ của bệnh nhân từ TT_BENHNHAN
public class PatientBasicInfo
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
    public string? GioiTinh { get; set; }  // Đã convert từ code sang text
    public int? Tuoi { get; set; }
    public DateTime? NgaySinh { get; set; }
    public DateTime? NgayGioSinh { get; set; }
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
    
    // Giấy tờ tùy thân
    public string? CMND { get; set; }
    public string? HoChieu { get; set; }
    
    // Thông tin y tế
    public string? NhomMau { get; set; }  // Đã convert từ code sang text
    public string? YeuToRh { get; set; }  // Đã convert từ code sang text
    public string? TienSuDiUng { get; set; }
    public string? TienSuBenh { get; set; }
    public string? TienSuHutThuocLa { get; set; }
    public string? SoLuuTruNoiTru { get; set; }
    public string? SoLuuTruNgoaiTru { get; set; }
    
    // Thông tin nhân khẩu học
    public string? NgheNghiepId { get; set; }
    public string? QuocTichId { get; set; }
    public string? DanTocId { get; set; }
    public string? TrinhDoVanHoaId { get; set; }
    public string? TinhTrangHonNhanId { get; set; }
    public string? VietKieu { get; set; }
    public string? NguoiNuocNgoai { get; set; }
    
    // Người liên hệ
    public string? NguoiLienHe { get; set; }
    public string? ThongTinNguoiLienHe { get; set; }
    public string? MoiQuanHeId { get; set; }
    
    // Thông tin tử vong
    public string? TuVong { get; set; }
    public DateTime? NgayTuVong { get; set; }
    public DateTime? ThoiGianTuVong { get; set; }
    public string? NguyenNhanTuVongId { get; set; }
    
    // Thông tin hệ thống
    public string? HinhAnhDaiDien { get; set; }
    public string? GhiChu { get; set; }
    public string? Active { get; set; }
    public string? BenhVienId { get; set; }
    public string? SiteId { get; set; }
    public DateTime? NgayTao { get; set; }
    public DateTime? NgayCapNhat { get; set; }
    public string? NguoiTaoId { get; set; }
    public string? NguoiCapNhatId { get; set; }
}

/// Request để đăng ký face
public class RegisterFaceRequest
{
    [Required]
    public string MaYTe { get; set; } = string.Empty;
    
    /// Base64 encoded image hoặc IFormFile
    public string? ImageBase64 { get; set; }
}


/// Response khi nhận diện thành công

public class FaceRecognitionResult
{
    public bool Recognized { get; set; }
    public float Confidence { get; set; }
    public string ConfidenceLevel { get; set; } = string.Empty; // "low", "medium", "high", "very_high"
    public PatientBasicInfo? Patient { get; set; }
    public string? Message { get; set; }
    public bool IsInQueue { get; set; }  // Bệnh nhân có đang trong hàng đợi hôm nay không
}


/// Thông tin bệnh nhân trong hàng đợi (JOIN từ HangDoiPhongBan và TT_BENHNHAN)
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
