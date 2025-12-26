using HospitalVision.Domain.Entities;
using HospitalVision.Domain.Interfaces;
using HospitalVision.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.Infrastructure.Repositories;

/// <summary>
/// FaceImage Repository implementation (Read/Write to K_QMS_YHCT database)
/// </summary>
public class FaceImageRepository : Repository<FaceImage>, IFaceImageRepository
{
    public FaceImageRepository(QmsDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<FaceImage>> GetByMaYTeAsync(string maYTe, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(f => f.MaYTe == maYTe && f.IsActive)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<FaceImage>> GetAllActiveEmbeddingsAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(f => f.IsActive && f.Embedding != null)
            .ToListAsync(cancellationToken);
    }

    public async Task DeleteByMaYTeAsync(string maYTe, CancellationToken cancellationToken = default)
    {
        var faces = await _dbSet
            .Where(f => f.MaYTe == maYTe)
            .ToListAsync(cancellationToken);

        if (faces.Any())
        {
            _dbSet.RemoveRange(faces);
        }
    }
}
