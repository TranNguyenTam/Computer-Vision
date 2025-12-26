namespace HospitalVision.API.DTOs;

// =====================================================
// DTOs cho Alert (Cảnh báo té ngã, etc.)
// =====================================================

/// <summary>
/// Request tạo alert té ngã
/// </summary>
public class FallAlertRequest
{
    public string? PatientId { get; set; }  // Backward compatible
    public string? MaYTe { get => PatientId; set => PatientId = value; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public string? CameraId { get; set; }
    public double Confidence { get; set; } = 1.0;
    public string AlertType { get; set; } = "fall";
    public string? FrameData { get; set; }
}

/// <summary>
/// Response alert té ngã
/// </summary>
public class FallAlertResponse
{
    public int Id { get; set; }
    public string? PatientId { get; set; }  // Backward compatible
    public string? MaYTe { get => PatientId; set => PatientId = value; }
    public string? PatientName { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public string? CameraId { get; set; }
    public double Confidence { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool HasImage { get; set; }
    public string? FrameData { get; set; }
}

/// <summary>
/// Request cập nhật trạng thái alert
/// </summary>
public class UpdateAlertStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? ResolvedBy { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// Alert dto cho list
/// </summary>
public class AlertDto
{
    public int Id { get; set; }
    public string AlertType { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? MaYTe { get; set; }
    public string? PatientName { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? CameraId { get; set; }
    public string? Location { get; set; }
    public double? Confidence { get; set; }
    public DateTime AlertTime { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolvedBy { get; set; }
    public string? Notes { get; set; }
    public bool IsResolved { get; set; }
    public bool HasImage { get; set; }
}

/// <summary>
/// Alert memory storage (temporary, until full DB implementation)
/// </summary>
public class FallAlertMemory
{
    public int Id { get; set; }
    public string PatientId { get; set; } = string.Empty;
    public string? PatientName { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; }
    public string? Status { get; set; }
    public string? FrameData { get; set; }
}

/// <summary>
/// Recent alert DTO for dashboard
/// </summary>
public class RecentAlertDto
{
    public int Id { get; set; }
    public string? PatientName { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// Recent detection DTO for dashboard
/// </summary>
public class RecentDetectionDto
{
    public string PatientId { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; }
}

// =====================================================
// DTOs cho Dashboard
// =====================================================

/// <summary>
/// Dashboard statistics DTO
/// </summary>
public class DashboardStatsDto
{
    public int TotalPatients { get; set; }
    public int TodayAppointments { get; set; }
    public int ActiveAlerts { get; set; }
    public int PatientsDetectedToday { get; set; }
    public List<RecentAlertDto> RecentAlerts { get; set; } = new();
    public List<RecentDetectionDto> RecentDetections { get; set; } = new();
}

// =====================================================
// DTOs cho Patient Info (API responses)
// =====================================================

/// <summary>
/// Patient information response DTO (lightweight)
/// </summary>
public class PatientInfoDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    
    public AppointmentInfoDto? CurrentAppointment { get; set; }
    public List<AppointmentInfoDto> UpcomingAppointments { get; set; } = new();
}

/// <summary>
/// Appointment information DTO
/// </summary>
public class AppointmentInfoDto
{
    public int Id { get; set; }
    public DateTime AppointmentTime { get; set; }
    public int QueueNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public string RoomId { get; set; } = string.Empty;
    public string RoomName { get; set; } = string.Empty;
    public string Floor { get; set; } = string.Empty;
    public string DoctorId { get; set; } = string.Empty;
    public string DoctorName { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

/// <summary>
/// Patient detection event request DTO
/// </summary>
public class PatientDetectedRequest
{
    public string PatientId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; } = 1.0;
    public string EventType { get; set; } = "patient_detected";
}

/// <summary>
/// Detection event memory storage
/// </summary>
public class DetectionEventMemory
{
    public string PatientId { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string Location { get; set; } = string.Empty;
}
