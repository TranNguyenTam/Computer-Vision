using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalVision.Domain.Entities;

/// <summary>
/// Entity hàng đợi phòng ban - mapping với bảng HangDoiPhongBan trong K_QMS_YHCT
/// </summary>
[Table("HangDoiPhongBan")]
public class HangDoiPhongBan
{
    [Key]
    [Column("HangDoiPhongBan_Id")]
    public int HangDoiPhongBanId { get; set; }

    [Column("HangDoi_Id")]
    public int? HangDoiId { get; set; }

    [Column("PhongBan_Id")]
    public int? PhongBanId { get; set; }

    [Column("STT")]
    public int? STT { get; set; }

    [Column("SoThuTuDayDu")]
    public string? SoThuTuDayDu { get; set; }

    [Column("STTTheoLoaiPhongBan")]
    public int? STTTheoLoaiPhongBan { get; set; }

    [Column("UuTien")]
    public int? UuTien { get; set; }

    [Column("YeuCau")]
    public int? YeuCau { get; set; }

    [Column("TinhTrang")]
    public int? TinhTrang { get; set; }

    [Column("NgayThucHien")]
    public DateTime? NgayThucHien { get; set; }

    [Column("NgayGioLaySo")]
    public DateTime? NgayGioLaySo { get; set; }

    [Column("NgayGioThucHien")]
    public DateTime? NgayGioThucHien { get; set; }

    [Column("NgayGioHoanTat")]
    public DateTime? NgayGioHoanTat { get; set; }

    [Column("BenhNhan_Id")]
    public int? BenhNhanId { get; set; }

    [Column("CLSYeuCau_Id")]
    public int? CLSYeuCauId { get; set; }

    [Column("LoaiPhieu")]
    public int? LoaiPhieu { get; set; }

    [Column("Huy")]
    public bool? Huy { get; set; }

    [Column("PhongBanGoi_Id")]
    public int? PhongBanGoiId { get; set; }

    [Column("NoiDung")]
    public string? NoiDung { get; set; }

    [Column("ThoiGian")]
    public int? ThoiGian { get; set; }

    [Column("BoQua")]
    public int? BoQua { get; set; }

    [Column("SoLuongChiDinh")]
    public int? SoLuongChiDinh { get; set; }

    [Column("TinhTrangHienTai")]
    public int? TinhTrangHienTai { get; set; }

    [Column("ViTriHienTai")]
    public string? ViTriHienTai { get; set; }

    // Computed property cho trạng thái
    [NotMapped]
    public string TinhTrangText => TinhTrang switch
    {
        0 => "Chờ khám",
        1 => "Đang khám",
        2 => "Hoàn thành",
        3 => "Hủy",
        _ => "Không xác định"
    };
}
