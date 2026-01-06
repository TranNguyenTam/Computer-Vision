using HospitalVision.API.Models.Entities;

namespace HospitalVision.API.Repositories.Interfaces;

public interface IFallAlertRepository : IRepository<FallAlert>
{
    Task<List<FallAlert>> GetActiveAlertsAsync();
    Task<List<FallAlert>> GetAlertsByStatusAsync(string status);
    Task<List<FallAlert>> GetAlertsPagedAsync(int page, int pageSize);
    Task<int> CountActiveAlertsAsync();
    Task<int> CountAllAlertsAsync();
    Task<List<FallAlert>> GetRecentAlertsAsync(int count = 10);
    Task<int> CountFallsTodayAsync();
    Task<int> CountFallsThisWeekAsync();
    Task<int> CountFallsThisMonthAsync();
}
