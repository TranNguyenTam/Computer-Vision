using HospitalVision.API.Models;

namespace HospitalVision.API.Repositories.Interfaces;

public interface IHangDoiPhongBanRepository : IRepository<HangDoiPhongBan>
{
    Task<HangDoiPhongBan?> GetByBenhNhanIdAsync(int benhNhanId);
    Task<List<HangDoiPhongBan>> GetActiveQueueAsync();
    Task<int?> GetBenhNhanIdByMaYTeAsync(string maYTe);
}
