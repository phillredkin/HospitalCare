
using System.Security.Cryptography;
using System.Text;
using HospitalCare.Web.Data;
using HospitalCare.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalCare.Web.Services;

public class SessionService
{
    private readonly ApplicationDbContext _db;

    public SessionService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<string> CreateSessionAsync(User user)
    {
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes);
        var tokenHash = HashToken(token);

        var now = DateTime.UtcNow;

        var session = new UserSession
        {
            UserId = user.Id,
            TokenHash = tokenHash,
            CreatedAt = now,
            LastActivityAt = now,
            ExpiresAt = now.AddHours(8)
        };

        _db.Sessions.Add(session);
        await _db.SaveChangesAsync();

        return token;
    }

    public async Task<User?> ValidateSessionAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var tokenHash = HashToken(token);

        var session = await _db.Sessions
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.TokenHash == tokenHash);

        if (session == null)
        {
            return null;
        }

        var now = DateTime.UtcNow;

        if (session.RevokedAt != null ||
            session.ExpiresAt <= now ||
            !session.User.IsActive)
        {
            return null;
        }

        session.LastActivityAt = now;
        await _db.SaveChangesAsync();

        return session.User;
    }

    public async Task RevokeSessionAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        var tokenHash = HashToken(token);

        var session = await _db.Sessions
            .FirstOrDefaultAsync(s => s.TokenHash == tokenHash);

        if (session == null || session.RevokedAt != null)
        {
            return;
        }

        session.RevokedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }

    public static string HashToken(string token)
    {
        var hashBytes = SHA256.HashData(
            Encoding.UTF8.GetBytes(token)
        );

        return Convert.ToHexString(hashBytes);
    }
}
