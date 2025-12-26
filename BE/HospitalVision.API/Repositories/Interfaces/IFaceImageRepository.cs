using HospitalVision.API.Models;

namespace HospitalVision.API.Repositories.Interfaces;

public interface IFaceImageRepository : IRepository<FaceImage>
{
    Task<List<FaceImage>> GetByMaYTeAsync(string maYTe);
    new Task<FaceImage?> GetByIdAsync(int id);
    Task<bool> DeleteByMaYTeAsync(string maYTe);
    Task<int> CountByMaYTeAsync(string maYTe);
    Task<List<string>> GetAllRegisteredMaYTesAsync();
}
