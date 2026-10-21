
using System.Security.Claims;
using HospitalCare.Web.Data;
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalCare.Web.Services;

public class ClinicalNoteService
{
    private readonly ApplicationDbContext _db;

    public ClinicalNoteService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<List<ClinicalNoteResponseDto>> GetByHospitalizationIdAsync(
        int hospitalizationId)
    {
        return await _db.ClinicalNotes
            .AsNoTracking()
            .Where(n => n.HospitalizationId == hospitalizationId)
            .OrderByDescending(n => n.CreatedAt)
            .ThenByDescending(n => n.Id)
            .Select(n => new ClinicalNoteResponseDto
            {
                Id = n.Id,
                HospitalizationId = n.HospitalizationId,
                DoctorId = n.DoctorId,
                Content = n.Content,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<ClinicalNoteResponseDto> CreateAsync(
        int hospitalizationId,
        int doctorId,
        CreateClinicalNoteRequestDto request)
    {
        if (hospitalizationId <= 0)
        {
            throw new ArgumentException(
                "ID госпіталізації має бути додатним числом.");
        }

        if (doctorId <= 0)
        {
            throw new ArgumentException(
                "Не вдалося визначити поточного користувача.");
        }

        var content = request.Content?.Trim();

        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ArgumentException(
                "Текст клінічної нотатки є обов'язковим.");
        }

        if (content.Length > 4000)
        {
            throw new ArgumentException(
                "Текст нотатки не може перевищувати 4000 символів.");
        }

        var hospitalizationExists = await _db.Hospitalizations
            .AnyAsync(h => h.Id == hospitalizationId);

        if (!hospitalizationExists)
        {
            throw new ArgumentException(
                $"Госпіталізацію з ID {hospitalizationId} не знайдено.");
        }

        var doctorExists = await _db.Users
            .AnyAsync(u => u.Id == doctorId);

        if (!doctorExists)
        {
            throw new ArgumentException(
                "Поточного користувача не знайдено.");
        }

        var note = new ClinicalNote
        {
            HospitalizationId = hospitalizationId,
            DoctorId = doctorId,
            Content = content,
            CreatedAt = DateTime.UtcNow
        };

        _db.ClinicalNotes.Add(note);
        await _db.SaveChangesAsync();

        return new ClinicalNoteResponseDto
        {
            Id = note.Id,
            HospitalizationId = note.HospitalizationId,
            DoctorId = note.DoctorId,
            Content = note.Content,
            CreatedAt = note.CreatedAt
        };
    }
}
