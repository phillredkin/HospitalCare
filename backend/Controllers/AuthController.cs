
using System.ComponentModel.DataAnnotations;
using HospitalCare.Web.Models;
using HospitalCare.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authorization;

namespace HospitalCare.Web.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const string SessionCookieName = "hospitalcare_session";

    private readonly AuthService _authService;
    private readonly SessionService _sessionService;
    private readonly IWebHostEnvironment _environment;

    public AuthController(
        AuthService authService,
        SessionService sessionService,
        IWebHostEnvironment environment)
    {
        _authService = authService;
        _sessionService = sessionService;
        _environment = environment;
    }

    // POST /api/auth/login
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
    [FromBody] LoginRequest request,
    [FromHeader(Name = "X-CSRF-TOKEN")] string? csrfToken = null)
    {
        var user = await _authService.ValidateCredentialsAsync(
            request.Email,
            request.Password);

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "Неправильний email або пароль."
            });
        }

        var token = await _sessionService.CreateSessionAsync(user);

        Response.Cookies.Append(
            SessionCookieName,
            token,
            CreateCookieOptions(DateTimeOffset.UtcNow.AddHours(8)));

        return Ok(ToUserResponse(user));
    }

    // POST /api/auth/logout
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
    [FromHeader(Name = "X-CSRF-TOKEN")] string? csrfToken = null)
    {
        var token = Request.Cookies[SessionCookieName];

        await _sessionService.RevokeSessionAsync(token);

        Response.Cookies.Delete(
            SessionCookieName,
            CreateCookieOptions(null));

        return NoContent();
    }

    // GET /api/auth/me
    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var token = Request.Cookies[SessionCookieName];

        var user = await _sessionService.ValidateSessionAsync(token);

        if (user == null)
        {
            Response.Cookies.Delete(
                SessionCookieName,
                CreateCookieOptions(null));

            return Unauthorized(new
            {
                message = "Сесія недійсна або закінчилася. Увійдіть знову."
            });
        }

        return Ok(ToUserResponse(user));
    }

    private CookieOptions CreateCookieOptions(DateTimeOffset? expires)
    {
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = !_environment.IsDevelopment() || Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = expires,
            IsEssential = true
        };
    }

    private static UserResponse ToUserResponse(User user)
    {
        return new UserResponse
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString()
        };
    }
}

public class LoginRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class UserResponse
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;
}
