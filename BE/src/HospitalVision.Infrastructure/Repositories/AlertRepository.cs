using HospitalVision.Domain.Entities;
using HospitalVision.Domain.Enums;
using HospitalVision.Domain.Interfaces;
using HospitalVision.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.Infrastructure.Repositories;

/// <summary>
/// Alert Repository implementation
/// </summary>
public class AlertRepository : Repository<Alert>, IAlertRepository
{
    public AlertRepository(QmsDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Alert>> GetRecentAlertsAsync(int count = 50, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .OrderByDescending(a => a.AlertTime)
            .Take(count)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<Alert>> GetUnresolvedAlertsAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(a => !a.IsResolved)
            .OrderByDescending(a => a.AlertTime)
            .ToListAsync(cancellationToken);
    }

    public async Task<Alert?> GetLatestFallAlertAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(a => a.Type == AlertType.FallDetection)
            .OrderByDescending(a => a.AlertTime)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
