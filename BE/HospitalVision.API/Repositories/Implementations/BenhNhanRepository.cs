using HospitalVision.API.Data;
using HospitalVision.API.Models;
using HospitalVision.API.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.API.Repositories.Implementations;

public class BenhNhanRepository : Repository<BenhNhan>, IBenhNhanRepository
{
    private readonly HospitalDbContext _hospitalContext;

    public BenhNhanRepository(HospitalDbContext context) : base(context)
    {
        _hospitalContext = context;
    }

    public async Task<BenhNhan?> GetByMaYTeAsync(string maYTe)
    {
        return await _hospitalContext.BenhNhans
            .FirstOrDefaultAsync(b => b.MaYTe == maYTe);
    }

    public async Task<List<BenhNhan>> SearchByNameOrMaYTeAsync(string searchTerm)
    {
        var lowerSearch = searchTerm.ToLower();
        return await _hospitalContext.BenhNhans
            .Where(b => 
                (b.TenBenhNhan != null && b.TenBenhNhan.ToLower().Contains(lowerSearch)) ||
                (b.MaYTe != null && b.MaYTe.ToLower().Contains(lowerSearch)))
            .OrderBy(b => b.TenBenhNhan)
            .Take(20)
            .ToListAsync();
    }

    public async Task<List<BenhNhan>> GetRecentPatientsAsync(int count = 10)
    {
        return await _hospitalContext.BenhNhans
            .OrderByDescending(b => b.NgayTao)
            .Take(count)
            .ToListAsync();
    }

    public async Task<List<BenhNhan>> GetPagedAsync(int page, int pageSize)
    {
        return await _hospitalContext.BenhNhans
            .OrderBy(b => b.BenhNhanId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }
}
