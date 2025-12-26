using HospitalVision.Domain.Entities;
using HospitalVision.Domain.Interfaces;
using HospitalVision.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.Infrastructure.Repositories;

public class DetectionHistoryRepository : Repository<DetectionHistory>, IDetectionHistoryRepository
{
    public DetectionHistoryRepository(QmsDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<DetectionHistory>> GetTodayDetectionsAsync(CancellationToken cancellationToken = default)
    {
        var today = DateTime.Today;
        return await _dbSet
            .Where(d => d.DetectedAt >= today)
            .OrderByDescending(d => d.DetectedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<string>> GetTodayDetectedMaYTeListAsync(CancellationToken cancellationToken = default)
    {
        var today = DateTime.Today;
        return await _dbSet
            .Where(d => d.DetectedAt >= today && d.MaYTe != null)
            .Select(d => d.MaYTe!)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> IsDetectedTodayAsync(string maYTe, CancellationToken cancellationToken = default)
    {
        var today = DateTime.Today;
        return await _dbSet.AnyAsync(d => d.MaYTe == maYTe && d.DetectedAt >= today, cancellationToken);
    }

    public async Task ClearTodayDetectionsAsync(CancellationToken cancellationToken = default)
    {
        var today = DateTime.Today;
        var todayRecords = await _dbSet
            .Where(d => d.DetectedAt >= today)
            .ToListAsync(cancellationToken);

        if (todayRecords.Any())
        {
            _dbSet.RemoveRange(todayRecords);
        }
    }

    public async Task<List<DetectionHistory>> GetRecentDetectionsAsync(int count = 10, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .OrderByDescending(d => d.DetectedAt)
            .Take(count)
            .ToListAsync(cancellationToken);
    }
}
