using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using HospitalVision.API.Models.Entities;

namespace HospitalVision.API.Models.Entities;

/// Bảng lưu lịch sử nhận diện tự động - mỗi bệnh nhân chỉ được ghi 1 lần trong ngày

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

[Table("FACE_IMAGES")]
public class FaceImage
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }
    
    [Required]
    [Column("MAYTE")]
    [StringLength(50)]
    public string MaYTe { get; set; } = string.Empty;
    
    [Column("IMAGE_PATH")]
    [StringLength(500)]
    public string? ImagePath { get; set; }
    
    // NOTE: Không lưu ảnh gốc để tiết kiệm dung lượng
    // Chỉ lưu embedding vector để nhận diện
    
    [Column("EMBEDDING")]
    public byte[]? Embedding { get; set; }
    
    [Column("EMBEDDING_SIZE")]
    public int? EmbeddingSize { get; set; }
    
    [Column("MODEL_NAME")]
    [StringLength(50)]
    public string? ModelName { get; set; }
    
    [Column("CREATED_AT")]
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    [Column("CREATED_BY")]
    [StringLength(100)]
    public string? CreatedBy { get; set; }
    
    [Column("IS_ACTIVE")]
    public bool IsActive { get; set; } = true;
    
    [Column("NOTE")]
    [StringLength(500)]
    public string? Note { get; set; }
    
    // Navigation property (không join trực tiếp vì dùng MAYTE không phải FK)
    [NotMapped]
    public BenhNhan? BenhNhan { get; set; }
}

// NOTE: All DTOs have been moved to DTOs.cs for better organization
