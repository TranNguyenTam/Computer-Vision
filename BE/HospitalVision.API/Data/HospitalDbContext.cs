using HospitalVision.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.API.Data;

/// DbContext cho database PRODUCT_HIS - chỉ đọc thông tin bệnh nhân
public class HospitalDbContext : DbContext
{
    public HospitalDbContext(DbContextOptions<HospitalDbContext> options) : base(options)
    {
    }
    
    // Bảng từ database PRODUCT_HIS chứa thông tin bệnh nhân
    public DbSet<BenhNhan> BenhNhans => Set<BenhNhan>();
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // TT_BENHNHAN configuration - map với bảng có sẵn
        modelBuilder.Entity<BenhNhan>(entity =>
        {
            entity.ToTable("TT_BENHNHAN");
        });
    }
}
