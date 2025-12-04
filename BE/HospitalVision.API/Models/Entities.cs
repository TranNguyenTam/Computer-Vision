namespace HospitalVision.API.Models;

public class Patient
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string InsuranceNumber { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public bool HasFaceEncoding { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
    public ICollection<FallAlert> FallAlerts { get; set; } = new List<FallAlert>();
}

/// Fall Alert entity
public class FallAlert
{
    public int Id { get; set; }
    public string? PatientId { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; }
    public string Status { get; set; } = "Active"; // Active, Acknowledged, Resolved, FalsePositive
    public string? ResolvedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? Notes { get; set; }
    public string? FrameData { get; set; } // Base64 encoded image
    
    // Navigation properties
    public Patient? Patient { get; set; }
}

/// Detection Event entity (for logging patient detections)
public class DetectionEvent
{
    public int Id { get; set; }
    public string PatientId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Location { get; set; }
    public double Confidence { get; set; }
    public string EventType { get; set; } = "Detection"; // Detection, CheckIn, CheckOut
    
    // Navigation properties
    public Patient? Patient { get; set; }
}

/// Appointment entity (for patient appointments)
public class Appointment
{
    public int Id { get; set; }
    public string PatientId { get; set; } = string.Empty;
    public DateTime ScheduledTime { get; set; }
    public string? DoctorName { get; set; }
    public string? Department { get; set; }
    public string Status { get; set; } = "Scheduled"; // Scheduled, CheckedIn, Completed, Cancelled
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public Patient? Patient { get; set; }
}