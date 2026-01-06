using HospitalVision.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.API.Data;

/// Chứa bảng HangDoiPhongBan, FACE_IMAGES và DETECTION_HISTORY
public class QmsDbContext : DbContext
{
    public QmsDbContext(DbContextOptions<QmsDbContext> options) : base(options)
    {
    }
    
    /// Bảng hàng đợi phòng ban - để lấy thông tin bệnh nhân đang khám
    public DbSet<HangDoiPhongBan> HangDoiPhongBans => Set<HangDoiPhongBan>();
    
    /// Bảng lưu ảnh khuôn mặt bệnh nhân
    public DbSet<FaceImage> FaceImages => Set<FaceImage>();
    
    /// Bảng lưu lịch sử nhận diện tự động
    public DbSet<DetectionHistory> DetectionHistories => Set<DetectionHistory>();
    
    /// Bảng lưu cảnh báo ngã (Fall Alerts)
    public DbSet<FallAlert> FallAlerts => Set<FallAlert>();
    
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
        
        // DETECTION_HISTORY configuration - lịch sử nhận diện
        modelBuilder.Entity<DetectionHistory>(entity =>
        {
            entity.ToTable("DETECTION_HISTORY");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.HasIndex(e => e.MaYTe);
            entity.HasIndex(e => e.SessionDate);
            entity.HasIndex(e => new { e.MaYTe, e.SessionDate }).IsUnique(); // Mỗi người 1 lần/ngày
        });
        
        // FALL_ALERTS configuration - cảnh báo ngã
        modelBuilder.Entity<FallAlert>(entity =>
        {
            entity.ToTable("FALL_ALERTS");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.HasIndex(e => e.PatientId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => new { e.Status, e.Timestamp });
        });
    }
}