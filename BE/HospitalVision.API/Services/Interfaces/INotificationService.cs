using HospitalVision.API.Models.DTOs;

namespace HospitalVision.API.Services.Interfaces;

public interface INotificationService
{
    Task SendFallAlertAsync(FallAlertResponse alert);
    Task SendPatientDetectedAsync(string patientId, string patientName, string? location);
    Task SendAlertStatusUpdateAsync(int alertId, string newStatus);
    Task BroadcastMessageAsync(string type, object data);
    
    // Legacy methods (optional - can keep for backwards compatibility)
    Task NotifyFallDetectedAsync(object alertData);
    Task NotifyFaceRecognizedAsync(object recognitionData);
}
