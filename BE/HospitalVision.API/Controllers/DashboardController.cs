using HospitalVision.API.Models.DTOs;
using HospitalVision.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace HospitalVision.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IPatientService _patientService;
    private readonly IAlertService _alertService;

    public DashboardController(IPatientService patientService, IAlertService alertService)
    {
        _patientService = patientService;
        _alertService = alertService;
    }

    /// Get ra thông tin thống kê cho dashboard
    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetStats()
    {
        var stats = await _patientService.GetDashboardStatsAsync();
        return Ok(stats);
    }

    /// Get trạng thái hệ thống
    [HttpGet("status")]
    public ActionResult GetStatus()
    {
        return Ok(new
        {
            status = "online",
            timestamp = DateTime.UtcNow,
            version = "1.0.0",
            services = new
            {
                database = "connected",
                signalR = "active",
                aiModule = "unknown" // Would need actual health check
            }
        });
    }
}
