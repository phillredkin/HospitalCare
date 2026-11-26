
using HospitalCare.Web.Data;
using HospitalCare.Web.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HospitalCare.Web.Services;

public class AuthService
{
    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        ApplicationDbContext db,
        IPasswordHasher<User> passwordHasher,
        ILogger<AuthService> logger)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    public async Task<User?> ValidateCredentialsAsync(
        string email,
        string password)
    {
        if (string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrEmpty(password))
        {
            _logger.LogWarning("Login rejected: empty credentials");
            return null;
        }

        var normalizedEmail = email.Trim();

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user == null)
        {
            _logger.LogWarning("Login rejected: user not found");
            return null;
        }

        if (!user.IsActive)
        {
            _logger.LogWarning("Login rejected: inactive user ID {UserId}", user.Id);
            return null;
        }

        var result = _passwordHasher.VerifyHashedPassword(
            user,
            user.PasswordHash,
            password
        );

        if (result == PasswordVerificationResult.Failed)
        {
            _logger.LogWarning("Login rejected: password verification failed for user ID {UserId}", user.Id);
            return null;
        }

        _logger.LogInformation(
            "Login credentials validated for user ID {UserId}",
            user.Id);

        return user;
    }
}


//using HospitalCare.Web.Data;
//using HospitalCare.Web.Models;
//using Microsoft.AspNetCore.Identity;
//using Microsoft.EntityFrameworkCore;

//namespace HospitalCare.Web.Services;

//public class AuthService
//{
//    private readonly ApplicationDbContext _db;
//    private readonly IPasswordHasher<User> _passwordHasher;

//    public AuthService(
//        ApplicationDbContext db,
//        IPasswordHasher<User> passwordHasher)
//    {
//        _db = db;
//        _passwordHasher = passwordHasher;
//    }

//    public async Task<User?> ValidateCredentialsAsync(
//        string email,
//        string password)
//    {
//        if (string.IsNullOrWhiteSpace(email) ||
//            string.IsNullOrEmpty(password))
//        {
//            return null;
//        }

//        var normalizedEmail = email.Trim();

//        var user = await _db.Users
//            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

//        if (user == null || !user.IsActive)
//        {
//            return null;
//        }

//        var result = _passwordHasher.VerifyHashedPassword(
//            user,
//            user.PasswordHash,
//            password
//        );

//        if (result == PasswordVerificationResult.Failed)
//        {
//            return null;
//        }

//        return user;
//    }
//}