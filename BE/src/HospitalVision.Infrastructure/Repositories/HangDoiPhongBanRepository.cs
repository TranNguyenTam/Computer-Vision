using HospitalVision.Domain.Entities;
using HospitalVision.Domain.Interfaces;
using HospitalVision.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.Infrastructure.Repositories;

/// <summary>
/// HangDoiPhongBan Repository implementation
/// </summary>
public class HangDoiPhongBanRepository : Repository<HangDoiPhongBan>, IHangDoiPhongBanRepository
{
    public HangDoiPhongBanRepository(QmsDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<HangDoiPhongBan>> GetTodayQueueAsync(CancellationToken cancellationToken = default)
    {
        var today = DateTime.Today;
        return await _dbSet
            .Where(h => h.NgayThucHien >= today && h.Huy != true)
            .OrderBy(h => h.STT)
            .ToListAsync(cancellationToken);
    }

    public async Task<HangDoiPhongBan?> GetByBenhNhanIdTodayAsync(int benhNhanId, CancellationToken cancellationToken = default)
    {
        var today = DateTime.Today;
        return await _dbSet
            .Where(h => h.BenhNhanId == benhNhanId && h.NgayThucHien >= today && h.Huy != true)
            .OrderByDescending(h => h.NgayGioLaySo)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<bool> IsInQueueTodayAsync(int benhNhanId, CancellationToken cancellationToken = default)
    {
        var today = DateTime.Today;
        return await _dbSet.AnyAsync(
            h => h.BenhNhanId == benhNhanId && h.NgayThucHien >= today && h.Huy != true, 
            cancellationToken);
    }
}
