using HospitalVision.API.Data;
using HospitalVision.API.Models;
using HospitalVision.API.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HospitalVision.API.Repositories.Implementations;

public class FaceImageRepository : Repository<FaceImage>, IFaceImageRepository
{
    private readonly QmsDbContext _qmsContext;

    public FaceImageRepository(QmsDbContext context) : base(context)
    {
        _qmsContext = context;
    }

    public async Task<List<FaceImage>> GetByMaYTeAsync(string maYTe)
    {
        return await _qmsContext.FaceImages
            .Where(f => f.MaYTe == maYTe)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync();
    }

    public override async Task<FaceImage?> GetByIdAsync(int id)
    {
        return await _qmsContext.FaceImages
            .FirstOrDefaultAsync(f => f.Id == id);
    }

    public async Task<bool> DeleteByMaYTeAsync(string maYTe)
    {
        var images = await _qmsContext.FaceImages
            .Where(f => f.MaYTe == maYTe)
            .ToListAsync();
        
        if (!images.Any())
            return false;

        _qmsContext.FaceImages.RemoveRange(images);
        return true;
    }

    public async Task<int> CountByMaYTeAsync(string maYTe)
    {
        return await _qmsContext.FaceImages
            .CountAsync(f => f.MaYTe == maYTe);
    }

    public async Task<List<string>> GetAllRegisteredMaYTesAsync()
    {
        return await _qmsContext.FaceImages
            .Select(f => f.MaYTe)
            .Distinct()
            .ToListAsync();
    }
}
