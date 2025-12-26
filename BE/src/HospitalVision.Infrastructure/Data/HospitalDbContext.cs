using HospitalVision.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.Infrastructure.Data;

public class HospitalDbContext : DbContext
{
    public HospitalDbContext(DbContextOptions<HospitalDbContext> options) : base(options)
    {
    }
    
    public DbSet<BenhNhan> BenhNhans => Set<BenhNhan>();
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // BenhNhan đã có Data Annotations, không cần Fluent API
        modelBuilder.Entity<BenhNhan>()
            .HasKey(e => e.BenhNhanId);
    }
}
