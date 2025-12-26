using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using HospitalVision.Domain.Enums;

namespace HospitalVision.Domain.Entities;

/// <summary>
/// Entity cảnh báo - lưu các sự kiện phát hiện (té ngã, xâm nhập, etc.)
/// </summary>
[Table("ALERTS")]
public class Alert
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }
    
    [Column("ALERT_TYPE")]
    public AlertType Type { get; set; } = AlertType.FallDetection;
    
    [Column("SEVERITY")]
    public AlertSeverity Severity { get; set; } = AlertSeverity.High;
    
    [Column("STATUS")]
    public AlertStatus Status { get; set; } = AlertStatus.New;
    
    [Column("MAYTE")]
    [StringLength(50)]
    public string? MaYTe { get; set; }
    
    [Column("PATIENT_NAME")]
    [StringLength(200)]
    public string? PatientName { get; set; }
    
    [Column("TITLE")]
    [StringLength(200)]
    public string? Title { get; set; }
    
    [Column("DESCRIPTION")]
    [StringLength(1000)]
    public string? Description { get; set; }
    
    [Column("CAMERA_ID")]
    [StringLength(50)]
    public string? CameraId { get; set; }
    
    [Column("LOCATION")]
    [StringLength(200)]
    public string? Location { get; set; }
    
    [Column("IMAGE_DATA")]
    public string? ImageData { get; set; }
    
    [Column("CONFIDENCE")]
    public double? Confidence { get; set; }
    
    [Column("ALERT_TIME")]
    public DateTime AlertTime { get; set; } = DateTime.Now;
    
    [Column("ACKNOWLEDGED_AT")]
    public DateTime? AcknowledgedAt { get; set; }
    
    [Column("ACKNOWLEDGED_BY")]
    [StringLength(100)]
    public string? AcknowledgedBy { get; set; }
    
    [Column("RESOLVED_AT")]
    public DateTime? ResolvedAt { get; set; }
    
    [Column("RESOLVED_BY")]
    [StringLength(100)]
    public string? ResolvedBy { get; set; }
    
    [Column("NOTES")]
    [StringLength(1000)]
    public string? Notes { get; set; }
    
    [Column("IS_RESOLVED")]
    public bool IsResolved { get; set; } = false;
    
    [Column("CREATED_AT")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
