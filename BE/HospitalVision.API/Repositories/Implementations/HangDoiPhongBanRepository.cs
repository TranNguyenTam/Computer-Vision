using HospitalVision.API.Data;
using HospitalVision.API.Models;
using HospitalVision.API.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.API.Repositories.Implementations;

public class HangDoiPhongBanRepository : Repository<HangDoiPhongBan>, IHangDoiPhongBanRepository
{
    private readonly QmsDbContext _qmsContext;
    private readonly HospitalDbContext _hospitalContext;

    public HangDoiPhongBanRepository(QmsDbContext qmsContext, HospitalDbContext hospitalContext) 
        : base(qmsContext)
    {
        _qmsContext = qmsContext;
        _hospitalContext = hospitalContext;
    }

    public async Task<HangDoiPhongBan?> GetByBenhNhanIdAsync(int benhNhanId)
    {
        return await _qmsContext.HangDoiPhongBans
            .FirstOrDefaultAsync(h => h.BenhNhanId == benhNhanId);
    }

    public async Task<List<HangDoiPhongBan>> GetActiveQueueAsync()
    {
        return await _qmsContext.HangDoiPhongBans
            .Where(h => h.TinhTrang == 1) // Active status
            .OrderBy(h => h.NgayGioLaySo)
            .ToListAsync();
    }

    public async Task<int?> GetBenhNhanIdByMaYTeAsync(string maYTe)
    {
        // First get BenhNhanId from TT_BENHNHAN
        var benhNhan = await _hospitalContext.BenhNhans
            .FirstOrDefaultAsync(b => b.MaYTe == maYTe);
        
        return benhNhan?.BenhNhanId;
    }
}
