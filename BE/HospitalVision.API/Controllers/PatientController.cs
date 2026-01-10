using HospitalVision.API.Models;
using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HospitalVision.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PatientController : ControllerBase
{
    private readonly IPatientService _patientService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<PatientController> _logger;

    public PatientController(
        IPatientService patientService,
        INotificationService notificationService,
        ILogger<PatientController> logger)
    {
        _patientService = patientService;
        _notificationService = notificationService;
        _logger = logger;
    }

    /// Get patient information by ID (used by AI module after face recognition)
    [HttpGet("{patientId}")]
    public async Task<ActionResult<PatientInfoDto>> GetPatientInfo(string patientId)
    {
        var patient = await _patientService.GetPatientInfoAsync(patientId);
        
        if (patient == null)
        {
            _logger.LogWarning("Patient not found: {PatientId}", patientId);
            return NotFound(new { message = $"Patient with ID '{patientId}' not found" });
        }

        return Ok(patient);
    }

    /// Get all patients (returns data from TT_BENHNHAN table)
    [HttpGet]
    public async Task<ActionResult<List<BenhNhan>>> GetAllPatients()
    {
        var patients = await _patientService.GetAllBenhNhansAsync();
        return Ok(patients);
    }

    /// Search patients by name, ID, or phone
    [HttpGet("search")]
    public async Task<ActionResult<List<BenhNhan>>> SearchPatients([FromQuery] string q)
    {
        if (string.IsNullOrEmpty(q))
        {
            return BadRequest(new { message = "Search term is required" });
        }

        var patients = await _patientService.SearchBenhNhansAsync(q);
        return Ok(patients);
    }

    /// Notify that a patient was detected by the AI module
    [HttpPost("detected")]
    public async Task<ActionResult> PatientDetected([FromBody] PatientDetectedRequest request)
    {
        _logger.LogInformation("Patient detected: {PatientId} at {Location}", 
            request.PatientId, request.Location);

        // Get patient info for notification
        if (int.TryParse(request.PatientId, out int benhNhanId))
        {
            var benhNhan = await _patientService.GetBenhNhanAsync(benhNhanId);
            
            if (benhNhan != null)
            {
                // Log detection event
                await _patientService.AddDetectionEventAsync(
                    request.PatientId,
                    benhNhan.TenBenhNhan ?? "Unknown",
                    request.Location ?? "Unknown");
                    
                // Send real-time notification
                await _notificationService.SendPatientDetectedAsync(
                    request.PatientId,
                    benhNhan.TenBenhNhan ?? "Unknown",
                    request.Location);
            }
        }

        return Ok(new { message = "Detection logged successfully" });
    }

    [HttpGet("by-face-id/{faceId}")]
    public async Task<ActionResult<BenhNhan>> GetPatientByFaceId(string faceId)
    {
        var patient = await _patientService.GetBenhNhanByFaceIdAsync(faceId);
        
        if (patient == null)
        {
            _logger.LogWarning("Patient not found for Face ID: {FaceId}", faceId);
            return NotFound(new { message = $"Patient with Face ID '{faceId}' not found" });
        }

        return Ok(patient);
    }
}
