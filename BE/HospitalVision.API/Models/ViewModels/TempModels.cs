namespace HospitalVision.API.Models.ViewModels;

/// <summary>
/// In-memory representation of Fall Alert (temporary storage)
/// Used for caching fall detection alerts before persistence
/// </summary>
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

/// <summary>
/// Face Detection Record (persistent storage)
/// Used for storing face recognition detection history
/// </summary>
public class FaceDetectionRecord
{
    public int Id { get; set; }
    public string MaYTe { get; set; } = "";
    public string PatientName { get; set; } = "";
    public double Confidence { get; set; }
    public DateTime DetectedAt { get; set; }
    public string? CameraId { get; set; }
    public string? Location { get; set; }
    public string? Note { get; set; }
}
