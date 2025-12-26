using HospitalVision.API.Models;
using HospitalVision.API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HospitalVision.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BenhNhanController : ControllerBase
{
    private readonly IPatientService _patientService;
    private readonly ILogger<BenhNhanController> _logger;

    public BenhNhanController(IPatientService patientService, ILogger<BenhNhanController> logger)
    {
        _patientService = patientService;
        _logger = logger;
    }

    /// Lấy danh sách bệnh nhân từ bảng TT_BENHNHAN (phân trang)
    [HttpGet]
    public async Task<ActionResult<object>> GetAll([FromQuery] int page = 1, [FromQuery] int count = 50)
    {
        try
        {
            // Validate parameters
            if (page < 1) page = 1;
            if (count < 1) count = 50;
            if (count > 100) count = 100; // Max 100 per request

            var result = await _patientService.GetPatientsWithPaginationAsync(page, count);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lấy danh sách bệnh nhân");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// Lấy thông tin bệnh nhân theo mã
    [HttpGet("{id:int}")]
    public async Task<ActionResult<BenhNhan>> GetById(int id)
    {
        try
        {
            var benhNhan = await _patientService.GetPatientByIdAsync(id);
            
            if (benhNhan == null)
            {
                return NotFound(new { message = $"Không tìm thấy bệnh nhân với ID: {id}" });
            }
            
            return Ok(benhNhan);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lấy thông tin bệnh nhân {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// Tìm kiếm bệnh nhân theo tên, mã y tế hoặc số điện thoại
    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<BenhNhan>>> Search([FromQuery] string? q)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return Ok(new List<BenhNhan>());
            }

            var results = await _patientService.SearchPatientsAsync(q, maxResults: 50);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi tìm kiếm bệnh nhân");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// Test kết nối database
    // [HttpGet("test-connection")]
    // public async Task<ActionResult> TestConnection()
    // {
    //     try
    //     {
    //         var canConnect = await _context.Database.CanConnectAsync();
    //         if (canConnect)
    //         {
    //             return Ok(new 
    //             { 
    //                 status = "success", 
    //                 message = "Kết nối database thành công!"
    //             });
    //         }
    //         return StatusCode(500, new { status = "failed", message = "Không thể kết nối database" });
    //     }
    //     catch (Exception ex)
    //     {
    //         _logger.LogError(ex, "Lỗi kết nối database");
    //         return StatusCode(500, new { status = "error", message = ex.Message });
    //     }
    // }

    // /// Lấy cấu trúc bảng TT_BENHNHAN
    // [HttpGet("schema")]
    // public async Task<ActionResult> GetTableSchema()
    // {
    //     try
    //     {
    //         var sql = @"
    //             SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
    //             FROM INFORMATION_SCHEMA.COLUMNS 
    //             WHERE TABLE_NAME = 'TT_BENHNHAN'
    //             ORDER BY ORDINAL_POSITION";
            
    //         var columns = new List<object>();
    //         using (var command = _context.Database.GetDbConnection().CreateCommand())
    //         {
    //             command.CommandText = sql;
    //             await _context.Database.OpenConnectionAsync();
                
    //             using (var reader = await command.ExecuteReaderAsync())
    //             {
    //                 while (await reader.ReadAsync())
    //                 {
    //                     columns.Add(new
    //                     {
    //                         ColumnName = reader["COLUMN_NAME"]?.ToString(),
    //                         DataType = reader["DATA_TYPE"]?.ToString(),
    //                         IsNullable = reader["IS_NULLABLE"]?.ToString(),
    //                         MaxLength = reader["CHARACTER_MAXIMUM_LENGTH"]
    //                     });
    //                 }
    //             }
    //         }
            
    //         return Ok(new { tableName = "TT_BENHNHAN", columns });
    //     }
    //     catch (Exception ex)
    //     {
    //         _logger.LogError(ex, "Lỗi khi lấy schema bảng");
    //         return StatusCode(500, new { error = ex.Message });
    //     }
    // }
}
