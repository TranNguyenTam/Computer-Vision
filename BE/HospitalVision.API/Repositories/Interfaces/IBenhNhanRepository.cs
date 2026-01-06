using HospitalVision.API.Models.Entities;

namespace HospitalVision.API.Repositories.Interfaces;

public interface IBenhNhanRepository : IRepository<BenhNhan>
{
    Task<BenhNhan?> GetByMaYTeAsync(string maYTe);
    Task<List<BenhNhan>> SearchByNameOrMaYTeAsync(string searchTerm);
    Task<List<BenhNhan>> GetRecentPatientsAsync(int count = 10);
    Task<List<BenhNhan>> GetPagedAsync(int page, int pageSize);
}
