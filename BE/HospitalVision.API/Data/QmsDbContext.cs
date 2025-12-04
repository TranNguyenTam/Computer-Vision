using HospitalVision.API.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.API.Data;

/// Chứa bảng HangDoiPhongBan và FACE_IMAGES
public class QmsDbContext : DbContext
{
    public QmsDbContext(DbContextOptions<QmsDbContext> options) : base(options)
    {
    }
    
    /// Bảng hàng đợi phòng ban - để lấy thông tin bệnh nhân đang khám
    public DbSet<HangDoiPhongBan> HangDoiPhongBans => Set<HangDoiPhongBan>();
    
    /// Bảng lưu ảnh khuôn mặt bệnh nhân
    public DbSet<FaceImage> FaceImages => Set<FaceImage>();
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // HangDoiPhongBan configuration 
        modelBuilder.Entity<HangDoiPhongBan>(entity =>
        {
            entity.ToTable("HangDoiPhongBan");
            entity.HasKey(e => e.HangDoiPhongBanId);
            entity.HasIndex(e => e.BenhNhanId);
            entity.HasIndex(e => e.TinhTrang);
            entity.HasIndex(e => e.NgayThucHien);
        });
        
        // FACE_IMAGES configuration - bảng lưu ảnh khuôn mặt
        modelBuilder.Entity<FaceImage>(entity =>
        {
            entity.ToTable("FACE_IMAGES");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.HasIndex(e => e.MaYTe);
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => new { e.MaYTe, e.IsActive });
        });
    }
}
