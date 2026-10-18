
using System.Security.Claims;
using System.Text.Encodings.Web;
using HospitalCare.Web.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace HospitalCare.Web.Authentication;

public class SessionAuthenticationHandler
    : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "HospitalCareSession";
    private const string CookieName = "hospitalcare_session";

    private readonly SessionService _sessionService;

    public SessionAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        SessionService sessionService)
        : base(options, logger, encoder)
    {
        _sessionService = sessionService;
    }

    protected override async Task<AuthenticateResult>
        HandleAuthenticateAsync()
    {
        // 1. Read the session token from the cookie.
        if (!Request.Cookies.TryGetValue(
                CookieName, out var token))
        {
            return AuthenticateResult.NoResult();
        }

        // 2. Validate the token against Azure SQL.
        var user = await _sessionService
            .ValidateSessionAsync(token);

        if (user == null)
        {
            return AuthenticateResult.Fail(
                "Invalid or expired session.");
        }

        // 3. Build the authenticated user's identity.
        var claims = new List<Claim>
        {
            new Claim(
                ClaimTypes.NameIdentifier,
                user.Id.ToString()),

            new Claim(
                ClaimTypes.Name,
                user.Name),

            new Claim(
                ClaimTypes.Email,
                user.Email),

            new Claim(
                ClaimTypes.Role,
                user.Role.ToString())
        };

        var identity = new ClaimsIdentity(
            claims,
            SchemeName);

        var principal = new ClaimsPrincipal(identity);

        // 4. Tell ASP.NET Core authentication succeeded.
        var ticket = new AuthenticationTicket(
            principal,
            SchemeName);

        return AuthenticateResult.Success(ticket);
    }
}
