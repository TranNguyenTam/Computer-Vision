using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Models.Entities;

namespace HospitalVision.API.Services.Interfaces;

public interface IAlertService
{
    Task<FallAlertResponse> CreateFallAlertAsync(FallAlertRequest request);
    Task<FallAlert?> GetAlertAsync(int alertId);
    Task<List<FallAlertResponse>> GetActiveAlertsAsync();
    Task<List<FallAlertResponse>> GetAllAlertsAsync(int page = 1, int pageSize = 20);
    Task<int> CountAllAlertsAsync();
    Task<bool> UpdateAlertStatusAsync(int alertId, UpdateAlertStatusRequest request);
    Task<bool> AcknowledgeAlertAsync(int alertId, string acknowledgedBy);
    Task<bool> ResolveAlertAsync(int alertId, string resolvedBy, string? notes);
}
