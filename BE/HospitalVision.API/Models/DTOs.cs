namespace HospitalVision.API.Models.DTOs;

/// Patient information response DTO
public class PatientInfoDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    
    // Current/Next appointment info
    public AppointmentInfoDto? CurrentAppointment { get; set; }
    public List<AppointmentInfoDto> UpcomingAppointments { get; set; } = new();
}

/// Appointment information DTO
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

/// Fall alert request DTO
public class FallAlertRequest
{
    public string? PatientId { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; } = 1.0;
    public string AlertType { get; set; } = "fall";
    public string? FrameData { get; set; }
}

/// Fall alert response DTO
public class FallAlertResponse
{
    public int Id { get; set; }
    public string? PatientId { get; set; }
    public string? PatientName { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool HasImage { get; set; }
    public string? FrameData { get; set; }  // Base64 encoded image
}

/// Patient detection event request DTO
public class PatientDetectedRequest
{
    public string PatientId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; } = 1.0;
    public string EventType { get; set; } = "patient_detected";
}

/// Update fall alert status request DTO
public class UpdateAlertStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? ResolvedBy { get; set; }
    public string? Notes { get; set; }
}

/// Dashboard statistics DTO
public class DashboardStatsDto
{
    public int TotalPatients { get; set; }
    public int TodayAppointments { get; set; }
    public int ActiveAlerts { get; set; }
    public int PatientsDetectedToday { get; set; }
    public List<RecentAlertDto> RecentAlerts { get; set; } = new();
    public List<RecentDetectionDto> RecentDetections { get; set; } = new();
}

/// Recent alert DTO for dashboard
public class RecentAlertDto
{
    public int Id { get; set; }
    public string? PatientName { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public string Status { get; set; } = string.Empty;
}

/// Recent detection DTO for dashboard
public class RecentDetectionDto
{
    public string PatientId { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; }  // Độ chính xác nhận diện
}

// =====================================================
// DTOs cho AI Camera Server - Nhận diện tự động
// =====================================================

/// Request để lưu embedding khi đăng ký khuôn mặt
public class SaveEmbeddingRequest
{
    public string MaYTe { get; set; } = string.Empty;
    public float[] Embedding { get; set; } = Array.Empty<float>();
    public string? ImagePath { get; set; }
    public string? ModelName { get; set; } = "Facenet512";
}

/// Request để ghi nhận diện tự động
public class RecordDetectionRequest
{
    public string MaYTe { get; set; } = string.Empty;
    public string? PatientName { get; set; }
    public double Confidence { get; set; }
    public string? CameraId { get; set; }
    public string? Location { get; set; }
    public string? Note { get; set; }
}

/// Request đăng ký khuôn mặt từ AI Server
public class RegisterFaceRequest
{
    /// <summary>
    /// Mã y tế bệnh nhân (bắt buộc)
    /// </summary>
    public string MaYTe { get; set; } = string.Empty;
    
    /// <summary>
    /// Ảnh dạng base64 (JPEG/PNG)
    /// </summary>
    public string? ImageBase64 { get; set; }
    
    /// <summary>
    /// Content type của ảnh (image/jpeg, image/png)
    /// </summary>
    public string? ContentType { get; set; }
    
    /// <summary>
    /// Vector embedding đã tính từ AI (512 floats cho Facenet512)
    /// </summary>
    public float[]? Embedding { get; set; }
    
    /// <summary>
    /// Tên model sử dụng (Facenet512, VGGFace, etc.)
    /// </summary>
    public string? ModelName { get; set; }
    
    /// <summary>
    /// Ghi chú
    /// </summary>
    public string? Note { get; set; }
}

/// Response khi lấy embeddings
public class EmbeddingData
{
    public string MaYTe { get; set; } = string.Empty;
    public List<EmbeddingVector> Embeddings { get; set; } = new();
}

public class EmbeddingVector
{
    public int EmbeddingSize { get; set; }
    public string? ModelName { get; set; }
    public float[]? Vector { get; set; }
}
