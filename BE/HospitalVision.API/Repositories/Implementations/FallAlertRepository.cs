using HospitalVision.API.Data;
using HospitalVision.API.Models.Entities;
using HospitalVision.API.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.API.Repositories.Implementations;

public class FallAlertRepository : Repository<FallAlert>, IFallAlertRepository
{
    private readonly QmsDbContext _qmsContext;

    public FallAlertRepository(QmsDbContext context) : base(context)
    {
        _qmsContext = context;
    }

    public async Task<List<FallAlert>> GetActiveAlertsAsync()
    {
        return await _qmsContext.FallAlerts
            .Where(a => a.Status == "Active" || a.Status == "Acknowledged")
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync();
    }

    public async Task<List<FallAlert>> GetAlertsByStatusAsync(string status)
    {
        return await _qmsContext.FallAlerts
            .Where(a => a.Status == status)
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync();
    }

    public async Task<List<FallAlert>> GetAlertsPagedAsync(int page, int pageSize)
    {
        return await _qmsContext.FallAlerts
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<int> CountActiveAlertsAsync()
    {
        return await _qmsContext.FallAlerts
            .CountAsync(a => a.Status == "Active" || a.Status == "Acknowledged");
    }

    public async Task<int> CountAllAlertsAsync()
    {
        return await _qmsContext.FallAlerts.CountAsync();
    }

    public async Task<List<FallAlert>> GetRecentAlertsAsync(int count = 10)
    {
        return await _qmsContext.FallAlerts
            .OrderByDescending(a => a.Timestamp)
            .Take(count)
            .ToListAsync();
    }
}
