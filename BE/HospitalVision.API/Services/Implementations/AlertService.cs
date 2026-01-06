using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Models.Entities;
using HospitalVision.API.Services.Interfaces;
using HospitalVision.API.Data.UnitOfWork;

namespace HospitalVision.API.Services.Implementations;

public class AlertService : IAlertService
{
    private readonly IPatientService _patientService;
    private readonly INotificationService _notificationService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<AlertService> _logger;
    
    public AlertService(
        IPatientService patientService,
        INotificationService notificationService,
        IUnitOfWork unitOfWork,
        ILogger<AlertService> logger)
    {
        _patientService = patientService;
        _notificationService = notificationService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<FallAlertResponse> CreateFallAlertAsync(FallAlertRequest request)
    {
        // Try to get patient name from BenhNhan table
        string? patientName = null;
        if (!string.IsNullOrEmpty(request.PatientId) && int.TryParse(request.PatientId, out int benhNhanId))
        {
            var benhNhan = await _patientService.GetBenhNhanAsync(benhNhanId);
            patientName = benhNhan?.TenBenhNhan;
        }
        
        var alert = new FallAlert
        {
            PatientId = request.PatientId ?? "",
            PatientName = patientName ?? "Unknown",
            Timestamp = request.Timestamp != default ? request.Timestamp : DateTime.UtcNow,
            Location = request.Location ?? "",
            Confidence = request.Confidence,
            Status = "Active",
            FrameData = request.FrameData
        };

        await _unitOfWork.FallAlerts.AddAsync(alert);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogWarning("FALL ALERT created: ID={AlertId}, Patient={PatientId}, Location={Location}",
            alert.Id, alert.PatientId, alert.Location);

        var response = new FallAlertResponse
        {
            Id = alert.Id,
            PatientId = alert.PatientId,
            PatientName = patientName,
            Timestamp = alert.Timestamp,
            Location = alert.Location,
            Confidence = alert.Confidence,
            Status = alert.Status,
            HasImage = !string.IsNullOrEmpty(alert.FrameData)
        };

        // Send real-time notification
        await _notificationService.SendFallAlertAsync(response);

        return response;
    }

    public async Task<FallAlert?> GetAlertAsync(int alertId)
    {
        return await _unitOfWork.FallAlerts.GetByIdAsync(alertId);
    }

    public async Task<List<FallAlertResponse>> GetActiveAlertsAsync()
    {
        var alerts = await _unitOfWork.FallAlerts.GetActiveAlertsAsync();
        
        return alerts.Select(a => new FallAlertResponse
        {
            Id = a.Id,
            PatientId = a.PatientId,
            PatientName = a.PatientName,
            Timestamp = a.Timestamp,
            Location = a.Location,
            Confidence = a.Confidence,
            Status = a.Status,
            HasImage = !string.IsNullOrEmpty(a.FrameData),
            FrameData = a.FrameData
        }).ToList();
    }

    public async Task<List<FallAlertResponse>> GetAllAlertsAsync(int page = 1, int pageSize = 20)
    {
        var alerts = await _unitOfWork.FallAlerts.GetAlertsPagedAsync(page, pageSize);
        
        return alerts.Select(a => new FallAlertResponse
        {
            Id = a.Id,
            PatientId = a.PatientId,
            PatientName = a.PatientName,
            Timestamp = a.Timestamp,
            Location = a.Location,
            Confidence = a.Confidence,
            Status = a.Status,
            HasImage = !string.IsNullOrEmpty(a.FrameData),
            FrameData = a.FrameData
        }).ToList();
    }

    public async Task<int> CountAllAlertsAsync()
    {
        return await _unitOfWork.FallAlerts.CountAllAlertsAsync();
    }

    public async Task<bool> UpdateAlertStatusAsync(int alertId, UpdateAlertStatusRequest request)
    {
        var alert = await _unitOfWork.FallAlerts.GetByIdAsync(alertId);
        if (alert == null)
            return false;

        alert.Status = request.Status;
        alert.Notes = request.Notes;

        if (request.Status == "Resolved" || request.Status == "FalsePositive")
        {
            alert.ResolvedBy = request.ResolvedBy;
            alert.ResolvedAt = DateTime.UtcNow;
        }

        _unitOfWork.FallAlerts.Update(alert);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Alert {AlertId} status updated to {Status}", alertId, request.Status);

        // Notify clients about status update (fire and forget)
        _ = _notificationService.SendAlertStatusUpdateAsync(alertId, request.Status);

        return true;
    }

    public Task<bool> AcknowledgeAlertAsync(int alertId, string acknowledgedBy)
    {
        return UpdateAlertStatusAsync(alertId, new UpdateAlertStatusRequest
        {
            Status = "Acknowledged",
            ResolvedBy = acknowledgedBy
        });
    }

    public Task<bool> ResolveAlertAsync(int alertId, string resolvedBy, string? notes)
    {
        return UpdateAlertStatusAsync(alertId, new UpdateAlertStatusRequest
        {
            Status = "Resolved",
            ResolvedBy = resolvedBy,
            Notes = notes
        });
    }
}