using HospitalVision.API.Hubs;
using HospitalVision.API.Models.DTOs;
using Microsoft.AspNetCore.SignalR;

namespace HospitalVision.API.Services;

public interface INotificationService
{
    Task SendFallAlertAsync(FallAlertResponse alert);
    Task SendPatientDetectedAsync(string patientId, string patientName, string? location);
    Task SendAlertStatusUpdateAsync(int alertId, string newStatus);
    Task BroadcastMessageAsync(string type, object data);
}

public class NotificationService : INotificationService
{
    private readonly IHubContext<AlertHub> _hubContext;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(IHubContext<AlertHub> hubContext, ILogger<NotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task SendFallAlertAsync(FallAlertResponse alert)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("FallAlert", alert);
            _logger.LogInformation("Sent fall alert notification: {AlertId}", alert.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send fall alert notification");
            throw;
        }
    }

    public async Task SendPatientDetectedAsync(string patientId, string patientName, string? location)
    {
        try
        {
            var data = new
            {
                PatientId = patientId,
                PatientName = patientName,
                Location = location,
                Timestamp = DateTime.UtcNow
            };

            await _hubContext.Clients.All.SendAsync("PatientDetected", data);
            _logger.LogInformation("Sent patient detected notification: {PatientId}", patientId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send patient detected notification");
            throw;
        }
    }

    public async Task SendAlertStatusUpdateAsync(int alertId, string newStatus)
    {
        try
        {
            var data = new
            {
                AlertId = alertId,
                Status = newStatus,
                Timestamp = DateTime.UtcNow
            };

            await _hubContext.Clients.All.SendAsync("AlertStatusUpdate", data);
            _logger.LogInformation("Sent alert status update: {AlertId} -> {Status}", alertId, newStatus);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send alert status update notification");
            throw;
        }
    }

    public async Task BroadcastMessageAsync(string type, object data)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync(type, data);
            _logger.LogDebug("Broadcast message: {Type}", type);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to broadcast message: {Type}", type);
            throw;
        }
    }
}
