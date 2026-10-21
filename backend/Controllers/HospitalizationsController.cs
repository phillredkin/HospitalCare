
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalCare.Web.Controllers;

[ApiController]
[Route("api/hospitalizations")]
[Authorize(Roles = "Admin,Doctor")]
public class HospitalizationsController : ControllerBase
{
    private readonly HospitalizationService _hospitalizationService;

    public HospitalizationsController(
        HospitalizationService hospitalizationService)
    {
        _hospitalizationService = hospitalizationService;
    }

    // GET /api/hospitalizations

    [HttpGet]
    public async Task<ActionResult<List<HospitalizationResponseDto>>> GetAll(
        [FromQuery] int? patientId)
    {
        if (patientId.HasValue && patientId.Value <= 0)
        {
            return BadRequest(new
            {
                message = "PatientId має бути додатним числом."
            });
        }

        var hospitalizations =
            await _hospitalizationService.GetAllAsync(patientId);

        return Ok(hospitalizations);
    }


    // GET /api/hospitalizations/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<HospitalizationResponseDto>> GetById(
        int id)
    {
        var hospitalization =
            await _hospitalizationService.GetByIdAsync(id);

        if (hospitalization == null)
        {
            return NotFound(new
            {
                message = $"Госпіталізацію з ID {id} не знайдено."
            });
        }

        return Ok(hospitalization);
    }

    // POST /api/hospitalizations
    [HttpPost]
    public async Task<ActionResult<HospitalizationResponseDto>> Create(
        [FromBody] CreateHospitalizationRequestDto request,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        // The configured antiforgery filter validates this header.
        _ = csrfToken;

        try
        {
            var hospitalization =
                await _hospitalizationService.CreateAsync(request);

            return CreatedAtAction(
                nameof(GetById),
                new { id = hospitalization.Id },
                hospitalization);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PATCH /api/hospitalizations/{id}
    [HttpPatch("{id:int}")]
    public async Task<ActionResult<HospitalizationResponseDto>> Update(
        int id,
        [FromBody] UpdateHospitalizationRequestDto request,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        // The configured antiforgery filter validates this header.
        _ = csrfToken;

        try
        {
            var hospitalization =
                await _hospitalizationService.UpdateAsync(id, request);

            if (hospitalization == null)
            {
                return NotFound(new
                {
                    message = $"Госпіталізацію з ID {id} не знайдено."
                });
            }

            return Ok(hospitalization);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
