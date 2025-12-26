namespace HospitalVision.Domain.Common;

/// <summary>
/// Base entity với các thuộc tính chung
/// </summary>
public abstract class BaseEntity
{
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// Base entity với Id kiểu int
/// </summary>
public abstract class BaseEntity<TId> : BaseEntity
{
    public TId Id { get; set; } = default!;
}
