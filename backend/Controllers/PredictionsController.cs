using System.Net;
using HospitalCare.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalCare.Web.Controllers;

[ApiController]
[Route("api/predictions")]
[Authorize(Roles = "Admin,Doctor")]
public class PredictionsController : ControllerBase
{
    private readonly MlPredictionService _predictionService;

    public PredictionsController(MlPredictionService predictionService)
    {
        _predictionService = predictionService;
    }

    [HttpPost("hospitalizations/{hospitalizationId:int}")]
    public async Task<IActionResult> Predict(int hospitalizationId)
    {
        if (hospitalizationId <= 0)
            return BadRequest(new { message = "Invalid hospitalization ID." });

        try
        {
            var result = await _predictionService.PredictAsync(hospitalizationId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            var status = ex.StatusCode == HttpStatusCode.UnprocessableEntity ? 422 : 502;

            return StatusCode(status, new
            {
                message = "ML service rejected the request.",
                details = status == 422 ? ex.Message : null
            });
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, new { message = "ML service timeout." });
        }
    }

    [HttpGet("{predictionId:guid}")]
    public async Task<IActionResult> GetPrediction(Guid predictionId)
    {
        try
        {
            var result = await _predictionService.GetPredictionAsync(predictionId);

            if (!result.HasValue)
                return NotFound(new { message = "Prediction not found." });

            return Ok(result.Value);
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { message = "ML service unavailable." });
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, new { message = "ML service timeout." });
        }
    }

    [HttpGet("hospitalizations/{hospitalizationId:int}/latest")]
    public async Task<IActionResult> GetLatestPrediction(int hospitalizationId)
    {
        if (hospitalizationId <= 0)
            return BadRequest(new { message = "Invalid hospitalization ID." });

        try
        {
            var result = await _predictionService.GetLatestPredictionAsync(hospitalizationId);

            if (!result.HasValue)
                return NotFound(new { message = "Prediction not found." });

            return Ok(result.Value);
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { message = "ML service unavailable." });
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, new { message = "ML service timeout." });
        }
    }
}