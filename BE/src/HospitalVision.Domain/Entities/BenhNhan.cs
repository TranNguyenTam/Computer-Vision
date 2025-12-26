using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalVision.Domain.Entities;

/// <summary>
/// Entity bệnh nhân - mapping với bảng TT_BENHNHAN trong PRODUCT_HIS
/// </summary>
[Table("TT_BENHNHAN")]
public class BenhNhan
{
    [Key]
    [Column("BENHNHAN_ID")]
    public int BenhNhanId { get; set; }
    
    [Column("MAYTE")]
    public string MaYTe { get; set; } = string.Empty;
    
    [Column("FID")]
    public string? FID { get; set; }
    
    [Column("SOVAOVIEN")]
    public string? SoVaoVien { get; set; }
    
    [Column("TENBENHNHAN")]
    public string? TenBenhNhan { get; set; }
    
    [Column("HO")]
    public string? Ho { get; set; }
    
    [Column("TEN")]
    public string? Ten { get; set; }
    
    [Column("GIOITINH")]
    public int? GioiTinh { get; set; }
    
    [Column("NGAYSINH")]
    public DateTime? NgaySinh { get; set; }
    
    [Column("NGAYGIOSINH")]
    public DateTime? NgayGioSinh { get; set; }
    
    [Column("NAMSINH")]
    public short? NamSinh { get; set; }
    
    [Column("MANOISINH")]
    public string? MaNoiSinh { get; set; }
    
    [Column("SODIENTHOAI")]
    public string? SoDienThoai { get; set; }
    
    [Column("SONHA")]
    public string? SoNha { get; set; }
    
    [Column("DIACHI")]
    public string? DiaChi { get; set; }
    
    [Column("DIACHITHUONGTRU")]
    public string? DiaChiThuongTru { get; set; }
    
    [Column("DIACHILIENLAC")]
    public string? DiaChiLienLac { get; set; }
    
    [Column("DIACHICOQUAN")]
    public string? DiaChiCoQuan { get; set; }
    
    [Column("TINHTHANH_ID")]
    public int? TinhThanhId { get; set; }
    
    [Column("QUANHUYEN_ID")]
    public int? QuanHuyenId { get; set; }
    
    [Column("XAPHUONG_ID")]
    public string? XaPhuongId { get; set; }
    
    [Column("SOLUUTRUNOITRU")]
    public string? SoLuuTruNoiTru { get; set; }
    
    [Column("SOLUUTRUNGOAITRU")]
    public string? SoLuuTruNgoaiTru { get; set; }
    
    [Column("NGHENGHIEP_ID")]
    public int? NgheNghiepId { get; set; }
    
    [Column("QUOCTICH_ID")]
    public int? QuocTichId { get; set; }
    
    [Column("DANTOC_ID")]
    public int? DanTocId { get; set; }
    
    [Column("VIETKIEU")]
    public string? VietKieu { get; set; }
    
    [Column("NGUOINUOCNGOAI")]
    public string? NguoiNuocNgoai { get; set; }
    
    [Column("CMND")]
    public string? CMND { get; set; }
    
    [Column("HOCHIEU")]
    public string? HoChieu { get; set; }
    
    [Column("EMAIL")]
    public string? Email { get; set; }
    
    [Column("HINHANH_DAIDIEN")]
    public string? HinhAnhDaiDien { get; set; }
    
    [Column("NHOMMAU_ID")]
    public int? NhomMauId { get; set; }
    
    [Column("YEUTORH_ID")]
    public int? YeuToRhId { get; set; }
    
    [Column("TIENSUDIUNG")]
    public string? TienSuDiUng { get; set; }
    
    [Column("TIENSUBENH")]
    public string? TienSuBenh { get; set; }
    
    [Column("TIENSUHUTTHUOCLA")]
    public string? TienSuHutThuocLa { get; set; }
    
    [Column("TUVONG")]
    public string? TuVong { get; set; }
    
    [Column("NGAYTUVONG")]
    public DateTime? NgayTuVong { get; set; }
    
    [Column("THOIGIANTUVONG")]
    public DateTime? ThoiGianTuVong { get; set; }
    
    [Column("NGUYENNHANTUVONG_ID")]
    public int? NguyenNhanTuVongId { get; set; }
    
    [Column("NGUOIGHINHANTUVONG_ID")]
    public int? NguoiGhiNhanTuVongId { get; set; }
    
    [Column("THOIGIANGHINHANTUVONG")]
    public DateTime? ThoiGianGhiNhanTuVong { get; set; }
    
    [Column("NHANVIEN_ID")]
    public int? NhanVienId { get; set; }
    
    [Column("DONVICONGTAC_ID")]
    public int? DonViCongTacId { get; set; }
    
    [Column("DIENTHOAIBAN")]
    public string? DienThoaiBan { get; set; }
    
    [Column("TINHTRANGHONNHAN_ID")]
    public int? TinhTrangHonNhanId { get; set; }
    
    [Column("NGUOILIENHE_ID")]
    public int? NguoiLienHeId { get; set; }
    
    [Column("NGUOILIENHE")]
    public string? NguoiLienHe { get; set; }
    
    [Column("THONGTIN_NLH")]
    public string? ThongTinNguoiLienHe { get; set; }
    
    [Column("MOIQUANHE_ID")]
    public int? MoiQuanHeId { get; set; }
    
    [Column("GHICHU")]
    public string? GhiChu { get; set; }
    
    [Column("ACTIVE")]
    public string? Active { get; set; }
    
    [Column("PID")]
    public string? PID { get; set; }
    
    [Column("SITE_ID")]
    public string? SiteId { get; set; }
    
    [Column("BENHVIEN_ID")]
    public string? BenhVienId { get; set; }
    
    [Column("NGAYTAO")]
    public DateTime? NgayTao { get; set; }
    
    [Column("NGUOITAO_ID")]
    public int? NguoiTaoId { get; set; }
    
    [Column("NGAYCAPNHAT")]
    public DateTime? NgayCapNhat { get; set; }
    
    [Column("NGUOICAPNHAT_ID")]
    public int? NguoiCapNhatId { get; set; }
    
    [Column("TRINHDOVANHOA_ID")]
    public int? TrinhDoVanHoaId { get; set; }

    // Computed properties
    [NotMapped]
    public int? Tuoi => NgaySinh.HasValue 
        ? (DateTime.Today.Year - NgaySinh.Value.Year - 
           (DateTime.Today.DayOfYear < NgaySinh.Value.DayOfYear ? 1 : 0))
        : NamSinh.HasValue 
            ? DateTime.Today.Year - NamSinh.Value 
            : null;
    
    [NotMapped]
    public string GioiTinhText => GioiTinh switch
    {
        1 => "Nam",
        2 or 0 => "Nữ",
        _ => "Không xác định"
    };
}
