
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalCare.Web.Controllers;

[ApiController]
[Route("api/patients")]
[Authorize(Roles = "Admin,Doctor")]
public class PatientsController : ControllerBase
{
    private readonly PatientService _patientService;

    public PatientsController(PatientService patientService)
    {
        _patientService = patientService;
    }

    // GET /api/patients
    [HttpGet]
    public async Task<ActionResult<List<PatientResponseDto>>> GetAll()
    {
        var patients = await _patientService.GetAllAsync();

        return Ok(patients);
    }

    // GET /api/patients/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<PatientResponseDto>> GetById(int id)
    {
        var patient = await _patientService.GetByIdAsync(id);

        if (patient == null)
        {
            return NotFound(new
            {
                message = $"Пацієнта з ID {id} не знайдено."
            });
        }

        return Ok(patient);
    }

    // POST /api/patients
    [HttpPost]
    public async Task<ActionResult<PatientResponseDto>> Create(
        [FromBody] CreatePatientRequestDto request,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        // The configured antiforgery filter validates this header.
        _ = csrfToken;

        try
        {
            var patient = await _patientService.CreateAsync(request);

            return CreatedAtAction(
                nameof(GetById),
                new { id = patient.Id },
                patient);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PATCH /api/patients/{id}
    [HttpPatch("{id:int}")]
    public async Task<ActionResult<PatientResponseDto>> Update(
        int id,
        [FromBody] UpdatePatientRequestDto request,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        // The configured antiforgery filter validates this header.
        _ = csrfToken;

        try
        {
            var patient = await _patientService.UpdateAsync(id, request);

            if (patient == null)
            {
                return NotFound(new
                {
                    message = $"Пацієнта з ID {id} не знайдено."
                });
            }

            return Ok(patient);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
