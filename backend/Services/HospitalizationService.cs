
using HospitalCare.Web.Data;
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalCare.Web.Services;

public class HospitalizationService
{
    private readonly ApplicationDbContext _db;

    public HospitalizationService(ApplicationDbContext db)
    {
        _db = db;
    }


    public async Task<List<HospitalizationResponseDto>> GetAllAsync(
        int? patientId = null)
    {
        var query = _db.Hospitalizations
            .AsNoTracking()
            .AsQueryable();

        if (patientId.HasValue)
        {
            query = query.Where(h => h.PatientId == patientId.Value);
        }

        var hospitalizations = await query
            .OrderByDescending(h => h.AdmissionDate)
            .ThenByDescending(h => h.Id)
            .ToListAsync();

        return hospitalizations
            .Select(MapToResponse)
            .ToList();
    }


    public async Task<HospitalizationResponseDto?> GetByIdAsync(int id)
    {
        var hospitalization = await _db.Hospitalizations
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.Id == id);

        return hospitalization == null
            ? null
            : MapToResponse(hospitalization);
    }

    public async Task<HospitalizationResponseDto> CreateAsync(
        CreateHospitalizationRequestDto request)
    {
        if (request.PatientId <= 0)
        {
            throw new ArgumentException(
                "Необхідно вказати коректний ID пацієнта.");
        }

        if (request.AdmissionDate == default)
        {
            throw new ArgumentException(
                "Дата госпіталізації є обов'язковою.");
        }

        ValidateDates(
            request.AdmissionDate,
            request.DischargeDate);

        var patientExists = await _db.Patients
            .AnyAsync(p => p.Id == request.PatientId);

        if (!patientExists)
        {
            throw new ArgumentException(
                $"Пацієнта з ID {request.PatientId} не знайдено.");
        }

        var hospitalization = new Hospitalization
        {
            PatientId = request.PatientId,
            AdmissionDate = request.AdmissionDate,
            DischargeDate = request.DischargeDate,
            AdmissionTypeId = request.AdmissionTypeId,
            DischargeDispositionId = request.DischargeDispositionId,

            Diag1 = request.Diag1?.Trim(),
            Diag2 = request.Diag2?.Trim(),
            Diag3 = request.Diag3?.Trim(),

            A1CResult = request.A1CResult?.Trim(),
            MaxGluSerum = request.MaxGluSerum?.Trim(),

            NumLabProcedures = request.NumLabProcedures,
            NumProcedures = request.NumProcedures,
            NumMedications = request.NumMedications,
            NumberDiagnoses = request.NumberDiagnoses,

            NumberOutpatient = request.NumberOutpatient,
            NumberEmergency = request.NumberEmergency,
            NumberInpatient = request.NumberInpatient,

            Change = request.Change?.Trim(),
            DiabetesMed = request.DiabetesMed?.Trim(),

            TimeInHospital = CalculateTimeInHospital(
                request.AdmissionDate,
                request.DischargeDate),

            CreatedAt = DateTime.UtcNow
        };

        _db.Hospitalizations.Add(hospitalization);

        await _db.SaveChangesAsync();

        return MapToResponse(hospitalization);
    }

    public async Task<HospitalizationResponseDto?> UpdateAsync(
        int id,
        UpdateHospitalizationRequestDto request)
    {
        var hospitalization = await _db.Hospitalizations
            .FirstOrDefaultAsync(h => h.Id == id);

        if (hospitalization == null)
        {
            return null;
        }

        var hasChanges = false;

        var admissionDate = request.AdmissionDate
            ?? hospitalization.AdmissionDate;

        var dischargeDate = request.DischargeDate
            ?? hospitalization.DischargeDate;

        if (request.AdmissionDate.HasValue
            && request.AdmissionDate.Value == default)
        {
            throw new ArgumentException(
                "Необхідно вказати коректну дату госпіталізації.");
        }

        ValidateDates(admissionDate, dischargeDate);

        if (request.AdmissionDate.HasValue)
        {
            hospitalization.AdmissionDate = admissionDate;
            hasChanges = true;
        }

        if (request.DischargeDate.HasValue)
        {
            hospitalization.DischargeDate = dischargeDate;
            hasChanges = true;
        }

        if (request.AdmissionTypeId.HasValue)
        {
            hospitalization.AdmissionTypeId =
                request.AdmissionTypeId.Value;
            hasChanges = true;
        }

        if (request.DischargeDispositionId.HasValue)
        {
            hospitalization.DischargeDispositionId =
                request.DischargeDispositionId.Value;
            hasChanges = true;
        }

        if (request.Diag1 != null)
        {
            hospitalization.Diag1 = request.Diag1.Trim();
            hasChanges = true;
        }

        if (request.Diag2 != null)
        {
            hospitalization.Diag2 = request.Diag2.Trim();
            hasChanges = true;
        }

        if (request.Diag3 != null)
        {
            hospitalization.Diag3 = request.Diag3.Trim();
            hasChanges = true;
        }

        if (request.A1CResult != null)
        {
            hospitalization.A1CResult = request.A1CResult.Trim();
            hasChanges = true;
        }

        if (request.MaxGluSerum != null)
        {
            hospitalization.MaxGluSerum = request.MaxGluSerum.Trim();
            hasChanges = true;
        }

        if (request.NumLabProcedures.HasValue)
        {
            hospitalization.NumLabProcedures =
                request.NumLabProcedures.Value;
            hasChanges = true;
        }

        if (request.NumProcedures.HasValue)
        {
            hospitalization.NumProcedures =
                request.NumProcedures.Value;
            hasChanges = true;
        }

        if (request.NumMedications.HasValue)
        {
            hospitalization.NumMedications =
                request.NumMedications.Value;
            hasChanges = true;
        }

        if (request.NumberDiagnoses.HasValue)
        {
            hospitalization.NumberDiagnoses =
                request.NumberDiagnoses.Value;
            hasChanges = true;
        }

        if (request.NumberOutpatient.HasValue)
        {
            hospitalization.NumberOutpatient =
                request.NumberOutpatient.Value;
            hasChanges = true;
        }

        if (request.NumberEmergency.HasValue)
        {
            hospitalization.NumberEmergency =
                request.NumberEmergency.Value;
            hasChanges = true;
        }

        if (request.NumberInpatient.HasValue)
        {
            hospitalization.NumberInpatient =
                request.NumberInpatient.Value;
            hasChanges = true;
        }

        if (request.Change != null)
        {
            hospitalization.Change = request.Change.Trim();
            hasChanges = true;
        }

        if (request.DiabetesMed != null)
        {
            hospitalization.DiabetesMed = request.DiabetesMed.Trim();
            hasChanges = true;
        }

        if (!hasChanges)
        {
            throw new ArgumentException(
                "Не передано жодного поля для оновлення.");
        }

        hospitalization.TimeInHospital =
            CalculateTimeInHospital(admissionDate, dischargeDate);

        await _db.SaveChangesAsync();

        return MapToResponse(hospitalization);
    }

    private static void ValidateDates(
        DateOnly admissionDate,
        DateOnly? dischargeDate)
    {
        if (dischargeDate.HasValue
            && dischargeDate.Value < admissionDate)
        {
            throw new ArgumentException(
                "Дата виписки не може бути раніше дати госпіталізації.");
        }
    }

    private static int? CalculateTimeInHospital(
        DateOnly admissionDate,
        DateOnly? dischargeDate)
    {
        if (!dischargeDate.HasValue)
        {
            return null;
        }

        return dischargeDate.Value.DayNumber
            - admissionDate.DayNumber;
    }

    private static HospitalizationResponseDto MapToResponse(
        Hospitalization hospitalization)
    {
        return new HospitalizationResponseDto
        {
            Id = hospitalization.Id,
            PatientId = hospitalization.PatientId,
            AdmissionDate = hospitalization.AdmissionDate,
            DischargeDate = hospitalization.DischargeDate,
            AdmissionTypeId = hospitalization.AdmissionTypeId,
            DischargeDispositionId =
                hospitalization.DischargeDispositionId,
            TimeInHospital = hospitalization.TimeInHospital,

            Diag1 = hospitalization.Diag1,
            Diag2 = hospitalization.Diag2,
            Diag3 = hospitalization.Diag3,

            A1CResult = hospitalization.A1CResult,
            MaxGluSerum = hospitalization.MaxGluSerum,

            NumLabProcedures = hospitalization.NumLabProcedures,
            NumProcedures = hospitalization.NumProcedures,
            NumMedications = hospitalization.NumMedications,
            NumberDiagnoses = hospitalization.NumberDiagnoses,

            NumberOutpatient = hospitalization.NumberOutpatient,
            NumberEmergency = hospitalization.NumberEmergency,
            NumberInpatient = hospitalization.NumberInpatient,

            Change = hospitalization.Change,
            DiabetesMed = hospitalization.DiabetesMed,
            CreatedAt = hospitalization.CreatedAt
        };
    }
}
