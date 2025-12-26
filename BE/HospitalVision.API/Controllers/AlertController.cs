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
    public async Task<ActionResult<FallAlertResponse>> CreateFallAlert([FromBody] FallAlertRequest request)
    {
        _logger.LogWarning("FALL ALERT received: Patient={PatientId}, Location={Location}, Confidence={Confidence}",
            request.PatientId, request.Location, request.Confidence);

        var alert = await _alertService.CreateFallAlertAsync(request);
        
        return CreatedAtAction(nameof(GetAlert), new { id = alert.Id }, alert);
    }

    /// Get active alerts
    [HttpGet("alerts/active")]
    public async Task<ActionResult<List<FallAlertResponse>>> GetActiveAlerts()
    {
        var alerts = await _alertService.GetActiveAlertsAsync();
        return Ok(alerts);
    }

    /// Get all alerts with pagination
    [HttpGet("alerts")]
    public async Task<ActionResult<List<FallAlertResponse>>> GetAllAlerts(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20)
    {
        var alerts = await _alertService.GetAllAlertsAsync(page, pageSize);
        return Ok(alerts);
    }

    /// Get specific alert
    [HttpGet("alerts/{id}")]
    public async Task<ActionResult<FallAlertResponse>> GetAlert(int id)
    {
        var alert = await _alertService.GetAlertAsync(id);
        
        if (alert == null)
        {
            return NotFound(new { message = $"Alert with ID '{id}' not found" });
        }

        return Ok(new FallAlertResponse
        {
            Id = alert.Id,
            PatientId = alert.PatientId,
            PatientName = alert.PatientName,
            Timestamp = alert.Timestamp,
            Location = alert.Location,
            Confidence = alert.Confidence,
            Status = alert.Status,
            HasImage = !string.IsNullOrEmpty(alert.FrameData),
            FrameData = alert.FrameData  // Include frame data
        });
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
    public async Task<ActionResult> UpdateAlertStatus(int id, [FromBody] UpdateAlertStatusRequest request)
    {
        var success = await _alertService.UpdateAlertStatusAsync(id, request);
        
        if (!success)
        {
            return NotFound(new { message = $"Alert with ID '{id}' not found" });
        }

        return Ok(new { message = "Status updated successfully" });
    }

    /// Acknowledge an alert
    [HttpPost("alerts/{id}/acknowledge")]
    public async Task<ActionResult> AcknowledgeAlert(int id, [FromBody] AcknowledgeRequest request)
    {
        var success = await _alertService.AcknowledgeAlertAsync(id, request.AcknowledgedBy);
        
        if (!success)
        {
            return NotFound(new { message = $"Alert with ID '{id}' not found" });
        }

        return Ok(new { message = "Alert acknowledged" });
    }

    /// Resolve an alert
    [HttpPost("alerts/{id}/resolve")]
    public async Task<ActionResult> ResolveAlert(int id, [FromBody] ResolveRequest request)
    {
        var success = await _alertService.ResolveAlertAsync(id, request.ResolvedBy, request.Notes);
        
        if (!success)
        {
            return NotFound(new { message = $"Alert with ID '{id}' not found" });
        }

        return Ok(new { message = "Alert resolved" });
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
