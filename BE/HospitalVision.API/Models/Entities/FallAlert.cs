using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalVision.API.Models.Entities;

/// <summary>
/// Fall Alert entity for persistent storage in database
/// Replaces the in-memory FallAlertMemory
/// </summary>
[Table("FALL_ALERTS")]
public class FallAlert
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }
    
    [Column("PATIENT_ID")]
    [StringLength(50)]
    public string? PatientId { get; set; }
    
    [Column("PATIENT_NAME")]
    [StringLength(200)]
    public string? PatientName { get; set; }
    
    [Column("TIMESTAMP")]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    [Column("LOCATION")]
    [StringLength(200)]
    public string? Location { get; set; }
    
    [Column("CONFIDENCE")]
    public double Confidence { get; set; }
    
    [Required]
    [Column("STATUS")]
    [StringLength(50)]
    public string Status { get; set; } = "Active";
    
    [Column("FRAME_DATA")]
    public string? FrameData { get; set; }  // Base64 encoded image
    
    [Column("NOTES")]
    [StringLength(1000)]
    public string? Notes { get; set; }
    
    [Column("RESOLVED_BY")]
    [StringLength(100)]
    public string? ResolvedBy { get; set; }
    
    [Column("RESOLVED_AT")]
    public DateTime? ResolvedAt { get; set; }
    
    [Column("ACKNOWLEDGED_BY")]
    [StringLength(100)]
    public string? AcknowledgedBy { get; set; }
    
    [Column("ACKNOWLEDGED_AT")]
    public DateTime? AcknowledgedAt { get; set; }
    
    [Column("CREATED_AT")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [Column("UPDATED_AT")]
    public DateTime? UpdatedAt { get; set; }
}
