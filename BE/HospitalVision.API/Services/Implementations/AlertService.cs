using HospitalVision.API.Models;
using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Services.Interfaces;

namespace HospitalVision.API.Services.Implementations;

public class AlertService : IAlertService
{
    private readonly IPatientService _patientService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<AlertService> _logger;
    
    private static int _nextAlertId = 1;
    
    // Shared static alerts list (temporary in-memory storage)
    private static readonly List<FallAlertMemory> _alerts = new();
    
    public AlertService(
        IPatientService patientService,
        INotificationService notificationService,
        ILogger<AlertService> logger)
    {
        _patientService = patientService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<FallAlertResponse> CreateFallAlertAsync(FallAlertRequest request)
    {
        var alertId = _nextAlertId++;
        
        // Try to get patient name from BenhNhan table
        string? patientName = null;
        if (!string.IsNullOrEmpty(request.PatientId) && int.TryParse(request.PatientId, out int benhNhanId))
        {
            var benhNhan = await _patientService.GetBenhNhanAsync(benhNhanId);
            patientName = benhNhan?.TenBenhNhan;
        }
        
        var alert = new FallAlertMemory
        {
            Id = alertId,
            PatientId = request.PatientId ?? "",
            PatientName = patientName ?? "Unknown",
            Timestamp = request.Timestamp != default ? request.Timestamp : DateTime.UtcNow,
            Location = request.Location ?? "",
            Confidence = request.Confidence,
            Status = "Active",
            FrameData = request.FrameData
        };

        _alerts.Add(alert);

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

    public Task<FallAlertMemory?> GetAlertAsync(int alertId)
    {
        var alert = _alerts.FirstOrDefault(a => a.Id == alertId);
        return Task.FromResult(alert);
    }

    public Task<List<FallAlertResponse>> GetActiveAlertsAsync()
    {
        var alerts = _alerts
            .Where(a => a.Status == "Active" || a.Status == "Acknowledged")
            .OrderByDescending(a => a.Timestamp)
            .Select(a => new FallAlertResponse
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
            })
            .ToList();
        
        return Task.FromResult(alerts);
    }

    public Task<List<FallAlertResponse>> GetAllAlertsAsync(int page = 1, int pageSize = 20)
    {
        var alerts = _alerts
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new FallAlertResponse
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
            })
            .ToList();
        
        return Task.FromResult(alerts);
    }

    public Task<bool> UpdateAlertStatusAsync(int alertId, UpdateAlertStatusRequest request)
    {
        var alert = _alerts.FirstOrDefault(a => a.Id == alertId);
        if (alert == null)
            return Task.FromResult(false);

        alert.Status = request.Status;
        alert.Notes = request.Notes;

        if (request.Status == "Resolved" || request.Status == "FalsePositive")
        {
            alert.ResolvedBy = request.ResolvedBy;
            alert.ResolvedAt = DateTime.UtcNow;
        }

        _logger.LogInformation("Alert {AlertId} status updated to {Status}", alertId, request.Status);

        // Notify clients about status update (fire and forget)
        _ = _notificationService.SendAlertStatusUpdateAsync(alertId, request.Status);

        return Task.FromResult(true);
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

