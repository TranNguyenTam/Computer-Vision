using HospitalVision.Domain.Entities;
using HospitalVision.Domain.Interfaces;
using HospitalVision.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.Infrastructure.Repositories;

/// <summary>
/// BenhNhan Repository implementation (Read-only from PRODUCT_HIS database)
/// </summary>
public class BenhNhanRepository : Repository<BenhNhan>, IBenhNhanRepository
{
    public BenhNhanRepository(HospitalDbContext context) : base(context)
    {
    }

    public async Task<BenhNhan?> GetByMaYTeAsync(string maYTe, CancellationToken cancellationToken = default)
    {
        return await _dbSet.FirstOrDefaultAsync(p => p.MaYTe == maYTe, cancellationToken);
    }

    public async Task<BenhNhan?> GetByIdAsync(int benhNhanId, CancellationToken cancellationToken = default)
    {
        return await _dbSet.FirstOrDefaultAsync(p => p.BenhNhanId == benhNhanId, cancellationToken);
    }

    public async Task<IEnumerable<BenhNhan>> SearchAsync(string keyword, int limit = 20, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(keyword))
            return Enumerable.Empty<BenhNhan>();

        var query = _dbSet.AsQueryable();

        query = query.Where(p => 
            p.MaYTe.Contains(keyword) || 
            (p.TenBenhNhan != null && p.TenBenhNhan.Contains(keyword)) ||
            (p.SoDienThoai != null && p.SoDienThoai.Contains(keyword)));

        return await query
            .OrderBy(p => p.TenBenhNhan)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> ExistsAsync(string maYTe, CancellationToken cancellationToken = default)
    {
        return await _dbSet.AnyAsync(p => p.MaYTe == maYTe, cancellationToken);
    }

    public async Task<List<BenhNhan>> GetAllAsync()
    {
        return await _dbSet.OrderBy(p => p.TenBenhNhan).ToListAsync();
    }

    public async Task<List<BenhNhan>> SearchBenhNhansAsync(string searchTerm)
    {
        return await _dbSet
            .Where(p => (p.TenBenhNhan != null && p.TenBenhNhan.Contains(searchTerm)) || 
                       (p.MaYTe != null && p.MaYTe.Contains(searchTerm)) ||
                       (p.SoDienThoai != null && p.SoDienThoai.Contains(searchTerm)))
            .OrderBy(p => p.TenBenhNhan)
            .ToListAsync();
    }

    public async Task<int> CountAsync()
    {
        return await _dbSet.CountAsync();
    }
}
