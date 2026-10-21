
using System.Security.Claims;
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalCare.Web.Controllers;

[ApiController]
[Route("api/hospitalizations/{hospitalizationId:int}/clinical-notes")]
[Authorize(Roles = "Admin,Doctor")]
public class ClinicalNotesController : ControllerBase
{
    private readonly ClinicalNoteService _clinicalNoteService;

    public ClinicalNotesController(
        ClinicalNoteService clinicalNoteService)
    {
        _clinicalNoteService = clinicalNoteService;
    }

    // GET /api/hospitalizations/{hospitalizationId}/clinical-notes
    [HttpGet]
    public async Task<ActionResult<List<ClinicalNoteResponseDto>>>
        GetByHospitalizationId(int hospitalizationId)
    {
        if (hospitalizationId <= 0)
        {
            return BadRequest(new
            {
                message = "ID госпіталізації має бути додатним числом."
            });
        }

        var notes =
            await _clinicalNoteService.GetByHospitalizationIdAsync(
                hospitalizationId);

        return Ok(notes);
    }

    // POST /api/hospitalizations/{hospitalizationId}/clinical-notes
    [HttpPost]
    public async Task<ActionResult<ClinicalNoteResponseDto>> Create(
        int hospitalizationId,
        [FromBody] CreateClinicalNoteRequestDto request,
        [FromHeader(Name = "X-CSRF-TOKEN")] string? csrfToken = null)
    {
        var doctorIdClaim =
            User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(doctorIdClaim, out var doctorId)
            || doctorId <= 0)
        {
            return Unauthorized(new
            {
                message = "Не вдалося визначити поточного користувача."
            });
        }

        try
        {
            var note = await _clinicalNoteService.CreateAsync(
                hospitalizationId,
                doctorId,
                request);

            return StatusCode(
                StatusCodes.Status201Created,
                note);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
