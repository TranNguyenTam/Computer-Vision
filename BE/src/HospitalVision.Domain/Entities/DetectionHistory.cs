using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalVision.Domain.Entities;

/// <summary>
/// Entity lịch sử nhận diện - mapping với bảng DETECTION_HISTORY trong K_QMS_YHCT
/// </summary>
[Table("DETECTION_HISTORY")]
public class DetectionHistory
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }
    
    [Required]
    [Column("MAYTE")]
    [StringLength(50)]
    public string MaYTe { get; set; } = string.Empty;
    
    [Column("PATIENT_NAME")]
    [StringLength(200)]
    public string? PatientName { get; set; }
    
    [Column("CONFIDENCE")]
    public double Confidence { get; set; }
    
    [Column("DETECTED_AT")]
    public DateTime DetectedAt { get; set; } = DateTime.Now;
    
    [Column("CAMERA_ID")]
    [StringLength(50)]
    public string? CameraId { get; set; }
    
    [Column("LOCATION")]
    [StringLength(200)]
    public string? Location { get; set; }
    
    [Column("SESSION_DATE")]
    public DateTime SessionDate { get; set; } = DateTime.Today;
    
    [Column("NOTE")]
    [StringLength(500)]
    public string? Note { get; set; }
}
