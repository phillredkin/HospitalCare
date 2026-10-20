
using HospitalCare.Web.Data;
using HospitalCare.Web.Dtos;
using Microsoft.EntityFrameworkCore;
using HospitalCare.Web.Models;

namespace HospitalCare.Web.Services;

public class PatientService
{
    private readonly ApplicationDbContext _db;

    public PatientService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<List<PatientResponseDto>> GetAllAsync()
    {
        return await _db.Patients
            .AsNoTracking()
            .OrderBy(p => p.Id)
            .Select(p => new PatientResponseDto
            {
                Id = p.Id,
                FirstName = p.FirstName,
                LastName = p.LastName,
                DateOfBirth = p.DateOfBirth,
                Gender = p.Gender,
                DiabetesType = p.DiabetesType,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<PatientResponseDto?> GetByIdAsync(int id)
    {
        return await _db.Patients
            .AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new PatientResponseDto
            {
                Id = p.Id,
                FirstName = p.FirstName,
                LastName = p.LastName,
                DateOfBirth = p.DateOfBirth,
                Gender = p.Gender,
                DiabetesType = p.DiabetesType,
                CreatedAt = p.CreatedAt
            })
            .FirstOrDefaultAsync();
    }

    public async Task<PatientResponseDto> CreateAsync(
        CreatePatientRequestDto request)
    {
        var firstName = request.FirstName.Trim();
        var lastName = request.LastName.Trim();
        var gender = request.Gender.Trim();
        var diabetesType = request.DiabetesType.Trim();

        if (string.IsNullOrWhiteSpace(firstName))
        {
            throw new ArgumentException(
                "Ім'я пацієнта обов'язкове.");
        }

        if (string.IsNullOrWhiteSpace(lastName))
        {
            throw new ArgumentException(
                "Прізвище пацієнта обов'язкове.");
        }

        if (string.IsNullOrWhiteSpace(gender))
        {
            throw new ArgumentException(
                "Стать пацієнта обов'язкова.");
        }

        if (string.IsNullOrWhiteSpace(diabetesType))
        {
            throw new ArgumentException(
                "Тип діабету обов'язковий.");
        }

        if (request.DateOfBirth.HasValue
            && request.DateOfBirth.Value > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new ArgumentException(
                "Дата народження не може бути в майбутньому.");
        }

        var patient = new Patient
        {
            FirstName = firstName,
            LastName = lastName,
            DateOfBirth = request.DateOfBirth,
            Gender = gender,
            DiabetesType = diabetesType,
            CreatedAt = DateTime.UtcNow
        };

        _db.Patients.Add(patient);
        await _db.SaveChangesAsync();

        return new PatientResponseDto
        {
            Id = patient.Id,
            FirstName = patient.FirstName,
            LastName = patient.LastName,
            DateOfBirth = patient.DateOfBirth,
            Gender = patient.Gender,
            DiabetesType = patient.DiabetesType,
            CreatedAt = patient.CreatedAt
        };
    }


    public async Task<PatientResponseDto?> UpdateAsync(
        int id,
        UpdatePatientRequestDto request)
    {
        var patient = await _db.Patients
            .FirstOrDefaultAsync(p => p.Id == id);

        if (patient == null)
        {
            return null;
        }

        var hasChanges = false;

        if (request.FirstName != null)
        {
            var firstName = request.FirstName.Trim();

            if (string.IsNullOrWhiteSpace(firstName))
            {
                throw new ArgumentException(
                    "Ім'я пацієнта не може бути порожнім.");
            }

            patient.FirstName = firstName;
            hasChanges = true;
        }

        if (request.LastName != null)
        {
            var lastName = request.LastName.Trim();

            if (string.IsNullOrWhiteSpace(lastName))
            {
                throw new ArgumentException(
                    "Прізвище пацієнта не може бути порожнім.");
            }

            patient.LastName = lastName;
            hasChanges = true;
        }

        if (request.Gender != null)
        {
            var gender = request.Gender.Trim();

            if (string.IsNullOrWhiteSpace(gender))
            {
                throw new ArgumentException(
                    "Стать пацієнта не може бути порожньою.");
            }

            patient.Gender = gender;
            hasChanges = true;
        }

        if (request.DiabetesType != null)
        {
            var diabetesType = request.DiabetesType.Trim();

            if (string.IsNullOrWhiteSpace(diabetesType))
            {
                throw new ArgumentException(
                    "Тип діабету не може бути порожнім.");
            }

            patient.DiabetesType = diabetesType;
            hasChanges = true;
        }

        if (request.DateOfBirth.HasValue)
        {
            if (request.DateOfBirth.Value >
                DateOnly.FromDateTime(DateTime.UtcNow))
            {
                throw new ArgumentException(
                    "Дата народження не може бути в майбутньому.");
            }

            patient.DateOfBirth = request.DateOfBirth.Value;
            hasChanges = true;
        }

        if (!hasChanges)
        {
            throw new ArgumentException(
                "Не передано жодного поля для оновлення.");
        }

        await _db.SaveChangesAsync();

        return new PatientResponseDto
        {
            Id = patient.Id,
            FirstName = patient.FirstName,
            LastName = patient.LastName,
            DateOfBirth = patient.DateOfBirth,
            Gender = patient.Gender,
            DiabetesType = patient.DiabetesType,
            CreatedAt = patient.CreatedAt
        };
    }

}
