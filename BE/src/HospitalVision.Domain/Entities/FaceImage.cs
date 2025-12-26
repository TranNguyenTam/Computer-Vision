using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalVision.Domain.Entities;

/// <summary>
/// Entity lưu embedding khuôn mặt - mapping với bảng FACE_IMAGES trong K_QMS_YHCT
/// </summary>
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
    
    // Navigation (không dùng FK trực tiếp vì dùng MAYTE không phải FK)
    [NotMapped]
    public BenhNhan? BenhNhan { get; set; }
}
