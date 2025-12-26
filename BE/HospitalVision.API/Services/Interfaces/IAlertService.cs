using HospitalVision.API.Models;
using HospitalVision.API.Models.DTOs;

namespace HospitalVision.API.Services.Interfaces;

public interface IAlertService
{
    Task<FallAlertResponse> CreateFallAlertAsync(FallAlertRequest request);
    Task<FallAlertMemory?> GetAlertAsync(int alertId);
    Task<List<FallAlertResponse>> GetActiveAlertsAsync();
    Task<List<FallAlertResponse>> GetAllAlertsAsync(int page = 1, int pageSize = 20);
    Task<bool> UpdateAlertStatusAsync(int alertId, UpdateAlertStatusRequest request);
    Task<bool> AcknowledgeAlertAsync(int alertId, string acknowledgedBy);
    Task<bool> ResolveAlertAsync(int alertId, string resolvedBy, string? notes);
}
