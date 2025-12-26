namespace HospitalVision.API.Models;

/// In-memory representation of Fall Alert (temporary storage)
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

/// Face Detection Record (persistent storage)
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