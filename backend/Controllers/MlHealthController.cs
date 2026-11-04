using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalCare.Web.Controllers;

[ApiController]
[Route("api/ml")]
[Authorize]
public class MlHealthController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;

    public MlHealthController(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet("health")]
    public async Task<IActionResult> Health()
    {
        var client = _httpClientFactory.CreateClient("MlService");

        try
        {
            using var response = await client.GetAsync("/health");
            var content = await response.Content.ReadAsStringAsync();

            return new ContentResult
            {
                Content = content,
                ContentType = "application/json",
                StatusCode = (int)response.StatusCode
            };
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { error = "ML service unavailable" });
        }
        catch (TaskCanceledException)
        {
            return StatusCode(504, new { error = "ML service timeout" });
        }
    }
}