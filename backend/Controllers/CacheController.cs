using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;

namespace HospitalCare.Web.Controllers;

[Route("api/cache")]
public class CacheController : Controller
{
    private readonly IDistributedCache _cache;

    public CacheController(IDistributedCache cache)
    {
        _cache = cache;
    }

    [HttpGet("test")]
    public async Task<IActionResult> Test()
    {
        const string key = "dashboard:test";

        var value = await _cache.GetStringAsync(key);

        if (value != null)
        {
            return Ok(new
            {
                source = "redis",
                value
            });
        }

        value = $"HospitalCare cache created at {DateTime.UtcNow:O}";

        await _cache.SetStringAsync(
            key,
            value,
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow =
                    TimeSpan.FromSeconds(60)
            });

        return Ok(new
        {
            source = "generated",
            value
        });
    }
}