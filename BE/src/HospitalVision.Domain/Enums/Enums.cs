namespace HospitalVision.Domain.Enums;

/// <summary>
/// Trạng thái của cảnh báo
/// </summary>
public enum AlertStatus
{
    New = 0,
    Acknowledged = 1,
    Resolved = 2,
    Ignored = 3
}

/// <summary>
/// Loại cảnh báo
/// </summary>
public enum AlertType
{
    FallDetection = 1,
    FaceRecognition = 2,
    Intrusion = 3,
    Other = 99
}

/// <summary>
/// Mức độ nghiêm trọng
/// </summary>
public enum AlertSeverity
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

/// <summary>
/// Giới tính
/// </summary>
public enum Gender
{
    Unknown = 0,
    Male = 1,
    Female = 2
}
