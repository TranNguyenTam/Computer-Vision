using HospitalVision.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.Infrastructure.Data;

public class QmsDbContext : DbContext
{
    public QmsDbContext(DbContextOptions<QmsDbContext> options) : base(options)
    {
    }
    
    public DbSet<HangDoiPhongBan> HangDoiPhongBans => Set<HangDoiPhongBan>();
    
    public DbSet<FaceImage> FaceImages => Set<FaceImage>();
    
    public DbSet<DetectionHistory> DetectionHistories => Set<DetectionHistory>();
    
    public DbSet<Alert> Alerts => Set<Alert>();
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // HangDoiPhongBan
        modelBuilder.Entity<HangDoiPhongBan>(entity =>
        {
            entity.HasKey(e => e.HangDoiPhongBanId);
            entity.HasIndex(e => e.BenhNhanId);
            entity.HasIndex(e => e.TinhTrang);
            entity.HasIndex(e => e.NgayThucHien);
        });
        
        // FaceImage
        modelBuilder.Entity<FaceImage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.HasIndex(e => e.MaYTe);
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => new { e.MaYTe, e.IsActive });
        });
        
        // DetectionHistory
        modelBuilder.Entity<DetectionHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.HasIndex(e => e.MaYTe);
            entity.HasIndex(e => e.SessionDate);
            entity.HasIndex(e => new { e.MaYTe, e.SessionDate }).IsUnique();
        });
        
        // Alert
        modelBuilder.Entity<Alert>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.HasIndex(e => e.MaYTe);
            entity.HasIndex(e => e.AlertTime);
            entity.HasIndex(e => e.IsResolved);
            entity.HasIndex(e => e.Status);
        });
    }
}
