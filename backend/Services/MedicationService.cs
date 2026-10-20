
using HospitalCare.Web.Data;
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalCare.Web.Services;

public class MedicationService
{
    private readonly ApplicationDbContext _db;

    public MedicationService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<List<MedicationResponseDto>> GetByHospitalizationIdAsync(
        int hospitalizationId)
    {
        return await _db.Medications
            .AsNoTracking()
            .Where(m => m.HospitalizationId == hospitalizationId)
            .OrderBy(m => m.MedicationName)
            .Select(m => new MedicationResponseDto
            {
                Id = m.Id,
                HospitalizationId = m.HospitalizationId,
                MedicationName = m.MedicationName,
                DoseStatus = m.DoseStatus
            })
            .ToListAsync();
    }

    public async Task<MedicationResponseDto> CreateAsync(
        int hospitalizationId,
        CreateMedicationRequestDto request)
    {
        if (hospitalizationId <= 0)
        {
            throw new ArgumentException(
                "ID госпіталізації має бути додатним числом.");
        }

        var medicationName = request.MedicationName?.Trim();
        var doseStatus = request.DoseStatus?.Trim();

        if (string.IsNullOrWhiteSpace(medicationName))
        {
            throw new ArgumentException(
                "Назва медикаменту є обов'язковою.");
        }

        if (medicationName.Length > 100)
        {
            throw new ArgumentException(
                "Назва медикаменту не може перевищувати 100 символів.");
        }

        if (string.IsNullOrWhiteSpace(doseStatus))
        {
            throw new ArgumentException(
                "Статус медикаменту є обов'язковим.");
        }

        var allowedStatuses = new[] { "No", "Steady", "Up", "Down" };

        if (!allowedStatuses.Contains(
                doseStatus,
                StringComparer.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                "Недопустимий статус. Дозволені значення: No, Steady, Up, Down.");
        }

        var hospitalizationExists = await _db.Hospitalizations
            .AnyAsync(h => h.Id == hospitalizationId);

        if (!hospitalizationExists)
        {
            throw new ArgumentException(
                $"Госпіталізацію з ID {hospitalizationId} не знайдено.");
        }

        var duplicateExists = await _db.Medications
            .AnyAsync(m =>
                m.HospitalizationId == hospitalizationId &&
                m.MedicationName == medicationName);

        if (duplicateExists)
        {
            throw new ArgumentException(
                "Такий медикамент уже додано до цієї госпіталізації.");
        }

        // Зберігаємо статус у форматі, який дозволяє обмеження SQL.
        doseStatus = allowedStatuses.First(
            s => string.Equals(
                s,
                doseStatus,
                StringComparison.OrdinalIgnoreCase));

        var medication = new Medication
        {
            HospitalizationId = hospitalizationId,
            MedicationName = medicationName,
            DoseStatus = doseStatus
        };

        _db.Medications.Add(medication);

        await _db.SaveChangesAsync();

        return new MedicationResponseDto
        {
            Id = medication.Id,
            HospitalizationId = medication.HospitalizationId,
            MedicationName = medication.MedicationName,
            DoseStatus = medication.DoseStatus
        };
    }
}
