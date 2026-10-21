
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalCare.Web.Controllers;

[ApiController]
[Route("api/hospitalizations/{hospitalizationId:int}/medications")]
[Authorize(Roles = "Admin,Doctor")]
public class MedicationsController : ControllerBase
{
    private readonly MedicationService _medicationService;

    public MedicationsController(MedicationService medicationService)
    {
        _medicationService = medicationService;
    }

    // GET /api/hospitalizations/{hospitalizationId}/medications
    [HttpGet]
    public async Task<ActionResult<List<MedicationResponseDto>>>
        GetByHospitalizationId(int hospitalizationId)
    {
        if (hospitalizationId <= 0)
        {
            return BadRequest(new
            {
                message = "ID госпіталізації має бути додатним числом."
            });
        }

        var medications =
            await _medicationService.GetByHospitalizationIdAsync(
                hospitalizationId);

        return Ok(medications);
    }

    // POST /api/hospitalizations/{hospitalizationId}/medications
    [HttpPost]
    public async Task<ActionResult<MedicationResponseDto>> Create(
        int hospitalizationId,
        [FromBody] CreateMedicationRequestDto request,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        // The configured antiforgery filter validates this header.
        _ = csrfToken;

        try
        {
            var medication =
                await _medicationService.CreateAsync(
                    hospitalizationId,
                    request);

            return StatusCode(
                StatusCodes.Status201Created,
                medication);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
