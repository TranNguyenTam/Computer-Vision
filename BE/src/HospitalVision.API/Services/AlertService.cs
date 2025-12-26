using HospitalVision.Domain.Interfaces;
using HospitalVision.API.Hubs;
using HospitalVision.API.DTOs;
using Microsoft.AspNetCore.SignalR;

namespace HospitalVision.API.Services;

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

public class AlertService : IAlertService
{
    private readonly IBenhNhanRepository _benhNhanRepository;
    private readonly INotificationService _notificationService;
    private readonly ILogger<AlertService> _logger;
    
    private static int _nextAlertId = 1;
    
    // Use shared alerts from PatientService
    private static List<FallAlertMemory> Alerts => PatientService.SharedAlerts;

    public AlertService(
        IBenhNhanRepository benhNhanRepository,
        INotificationService notificationService,
        ILogger<AlertService> logger)
    {
        _benhNhanRepository = benhNhanRepository;
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
            var benhNhan = await _benhNhanRepository.GetByIdAsync(benhNhanId);
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

        Alerts.Add(alert);

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
        var alert = Alerts.FirstOrDefault(a => a.Id == alertId);
        return Task.FromResult(alert);
    }

    public Task<List<FallAlertResponse>> GetActiveAlertsAsync()
    {
        var alerts = Alerts
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
        var alerts = Alerts
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
        var alert = Alerts.FirstOrDefault(a => a.Id == alertId);
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

// Extended FallAlertMemory for full alert data
public class FallAlertMemory
{
    public int Id { get; set; }
    public string PatientId { get; set; } = "";
    public string PatientName { get; set; } = "";
    public DateTime Timestamp { get; set; }
    public string Location { get; set; } = "";
    public double Confidence { get; set; }
    public string Status { get; set; } = "Active";
    public string? FrameData { get; set; }
    public string? Notes { get; set; }
    public string? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }
}
