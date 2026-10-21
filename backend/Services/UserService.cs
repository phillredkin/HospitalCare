
using HospitalCare.Web.Data;
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HospitalCare.Web.Services;

public class UserService
{
    private readonly ApplicationDbContext _db;
    private readonly IPasswordHasher<User> _passwordHasher;

    public UserService(
        ApplicationDbContext db,
        IPasswordHasher<User> passwordHasher)
    {
        _db = db;
        _passwordHasher = passwordHasher;
    }

    public async Task<List<UserResponseDto>> GetAllAsync()
    {
        var users = await _db.Users
            .AsNoTracking()
            .OrderBy(u => u.Id)
            .Select(u => new UserResponseDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Role = u.Role.ToString(),
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return users;
    }

    public async Task<UserResponseDto?> GetByIdAsync(int id)
    {
        return await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => new UserResponseDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Role = u.Role.ToString(),
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            })
            .FirstOrDefaultAsync();
    }

    public async Task<UserResponseDto> CreateAsync(
        CreateUserRequestDto request)
    {
        var name = request.Name.Trim();
        var email = request.Email.Trim();
        var roleText = request.Role.Trim();

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException(
                "Ім'я користувача обов'язкове.");
        }

        if (string.IsNullOrWhiteSpace(request.Password)
            || request.Password.Length < 8)
        {
            throw new ArgumentException(
                "Пароль повинен містити щонайменше 8 символів.");
        }

        if (!Enum.TryParse<UserRole>(
                roleText,
                true,
                out var role)
            || !Enum.IsDefined(role)
            || !(roleText.Equals(
                    nameof(UserRole.Admin),
                    StringComparison.OrdinalIgnoreCase)
                || roleText.Equals(
                    nameof(UserRole.Doctor),
                    StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException(
                "Роль повинна бути Admin або Doctor.");
        }

        var emailExists = await _db.Users
            .AnyAsync(u => u.Email == email);

        if (emailExists)
        {
            throw new InvalidOperationException(
                "Користувач із таким email вже існує.");
        }

        var user = new User
        {
            Name = name,
            Email = email,
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        user.PasswordHash = _passwordHasher.HashPassword(
            user,
            request.Password);

        _db.Users.Add(user);

        await _db.SaveChangesAsync();

        return new UserResponseDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }

    public async Task<UserResponseDto?> UpdateAsync(
        int id,
        UpdateUserRequestDto request)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return null;
        }

        var hasChanges = false;

        if (request.Name != null)
        {
            var name = request.Name.Trim();

            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException(
                    "Ім'я користувача не може бути порожнім.");
            }

            user.Name = name;
            hasChanges = true;
        }

        if (request.Email != null)
        {
            var email = request.Email.Trim();

            if (string.IsNullOrWhiteSpace(email))
            {
                throw new ArgumentException(
                    "Email не може бути порожнім.");
            }

            var emailExists = await _db.Users.AnyAsync(
                u => u.Email == email && u.Id != id);

            if (emailExists)
            {
                throw new InvalidOperationException(
                    "Користувач із таким email вже існує.");
            }

            user.Email = email;
            hasChanges = true;
        }

        if (request.Role != null)
        {
            var roleText = request.Role.Trim();

            if (!Enum.TryParse<UserRole>(
                    roleText,
                    true,
                    out var role)
                || !Enum.IsDefined(role)
                || !(roleText.Equals(
                        nameof(UserRole.Admin),
                        StringComparison.OrdinalIgnoreCase)
                    || roleText.Equals(
                        nameof(UserRole.Doctor),
                        StringComparison.OrdinalIgnoreCase)))
            {
                throw new ArgumentException(
                    "Роль повинна бути Admin або Doctor.");
            }

            user.Role = role;
            hasChanges = true;
        }

        if (request.IsActive.HasValue)
        {
            user.IsActive = request.IsActive.Value;
            hasChanges = true;
        }

        if (!hasChanges)
        {
            throw new ArgumentException(
                "Не передано жодного поля для оновлення.");
        }

        await _db.SaveChangesAsync();

        return new UserResponseDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }



}
