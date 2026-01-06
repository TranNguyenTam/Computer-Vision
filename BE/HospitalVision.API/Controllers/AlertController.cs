using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HospitalVision.API.Controllers;

[ApiController]
[Route("api")]
public class AlertController : ControllerBase
{
    private readonly IAlertService _alertService;
    private readonly ILogger<AlertController> _logger;

    public AlertController(IAlertService alertService, ILogger<AlertController> logger)
    {
        _alertService = alertService;
        _logger = logger;
    }

    /// Receive fall alert from AI module
    [HttpPost("fall-alert")]
    public async Task<ActionResult<ApiResponse<FallAlertResponse>>> CreateFallAlert([FromBody] FallAlertRequest request)
    {
        _logger.LogWarning("FALL ALERT received: Patient={PatientId}, Location={Location}, Confidence={Confidence}",
            request.PatientId, request.Location, request.Confidence);

        var alert = await _alertService.CreateFallAlertAsync(request);
        
        return CreatedAtAction(nameof(GetAlert), 
            new { id = alert.Id }, 
            ApiResponse<FallAlertResponse>.Ok(alert, "Fall alert created successfully"));
    }

    /// Get active alerts
    [HttpGet("alerts/active")]
    public async Task<ActionResult<ApiResponse<List<FallAlertResponse>>>> GetActiveAlerts()
    {
        var alerts = await _alertService.GetActiveAlertsAsync();
        return Ok(ApiResponse<List<FallAlertResponse>>.Ok(alerts));
    }

    /// Get all alerts with pagination
    [HttpGet("alerts")]
    public async Task<ActionResult<PagedApiResponse<FallAlertResponse>>> GetAllAlerts(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20)
    {
        var alerts = await _alertService.GetAllAlertsAsync(page, pageSize);
        var totalItems = await _alertService.CountAllAlertsAsync();
        
        return Ok(PagedApiResponse<FallAlertResponse>.Ok(alerts, page, pageSize, totalItems));
    }

    /// Get specific alert
    [HttpGet("alerts/{id}")]
    public async Task<ActionResult<ApiResponse<FallAlertResponse>>> GetAlert(int id)
    {
        var alert = await _alertService.GetAlertAsync(id);
        
        if (alert == null)
        {
            return NotFound(ApiResponse<FallAlertResponse>.NotFound($"Alert with ID '{id}' not found"));
        }

        var response = new FallAlertResponse
        {
            Id = alert.Id,
            PatientId = alert.PatientId,
            PatientName = alert.PatientName,
            Timestamp = alert.Timestamp,
            Location = alert.Location,
            Confidence = alert.Confidence,
            Status = alert.Status,
            HasImage = !string.IsNullOrEmpty(alert.FrameData),
            FrameData = alert.FrameData
        };
        
        return Ok(ApiResponse<FallAlertResponse>.Ok(response));
    }

    /// Get alert image
    [HttpGet("alerts/{id}/image")]
    public async Task<ActionResult> GetAlertImage(int id)
    {
        var alert = await _alertService.GetAlertAsync(id);
        
        if (alert == null)
        {
            return NotFound(new { message = $"Alert with ID '{id}' not found" });
        }

        if (string.IsNullOrEmpty(alert.FrameData))
        {
            return NotFound(new { message = "No image available for this alert" });
        }

        try
        {
            var imageBytes = Convert.FromBase64String(alert.FrameData);
            return File(imageBytes, "image/jpeg");
        }
        catch
        {
            return BadRequest(new { message = "Invalid image data" });
        }
    }

    /// Update alert status
    [HttpPut("alerts/{id}/status")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateAlertStatus(int id, [FromBody] UpdateAlertStatusRequest request)
    {
        var success = await _alertService.UpdateAlertStatusAsync(id, request);
        
        if (!success)
        {
            return NotFound(ApiResponse<object>.NotFound($"Alert with ID '{id}' not found"));
        }

        return Ok(ApiResponse<object>.Ok(new { }, "Status updated successfully"));
    }

    /// Acknowledge an alert
    [HttpPost("alerts/{id}/acknowledge")]
    public async Task<ActionResult<ApiResponse<object>>> AcknowledgeAlert(int id, [FromBody] AcknowledgeRequest request)
    {
        var success = await _alertService.AcknowledgeAlertAsync(id, request.AcknowledgedBy);
        
        if (!success)
        {
            return NotFound(ApiResponse<object>.NotFound($"Alert with ID '{id}' not found"));
        }

        return Ok(ApiResponse<object>.Ok(new { }, "Alert acknowledged"));
    }

    /// Resolve an alert
    [HttpPost("alerts/{id}/resolve")]
    public async Task<ActionResult<ApiResponse<object>>> ResolveAlert(int id, [FromBody] ResolveRequest request)
    {
        var success = await _alertService.ResolveAlertAsync(id, request.ResolvedBy, request.Notes);
        
        if (!success)
        {
            return NotFound(ApiResponse<object>.NotFound($"Alert with ID '{id}' not found"));
        }

        return Ok(ApiResponse<object>.Ok(new { }, "Alert resolved"));
    }
}

public class AcknowledgeRequest
{
    public string AcknowledgedBy { get; set; } = string.Empty;
}

public class ResolveRequest
{
    public string ResolvedBy { get; set; } = string.Empty;
    public string? Notes { get; set; }
}
