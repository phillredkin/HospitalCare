using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HospitalCare.Web.Data;
using HospitalCare.Web.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace HospitalCare.Web.Services;

public class MlPredictionService
{
    private readonly ApplicationDbContext _db;
    private readonly HttpClient _client;
    private readonly IDistributedCache _cache;

    public MlPredictionService(ApplicationDbContext db, IHttpClientFactory factory, IDistributedCache cache)
    {
        _db = db;
        _client = factory.CreateClient("MlService");
        _cache = cache;
    }

    private static string GetCacheKey(int hospitalizationId)
    {
        return $"prediction:hospitalization:{hospitalizationId}";
    }

    private async Task CachePredictionAsync(int hospitalizationId, JsonElement result)
    {
        try
        {
            await _cache.SetStringAsync(GetCacheKey(hospitalizationId), result.GetRawText(), new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
            });
        }
        catch (Exception)
        {
            // Redis failure must not prevent prediction retrieval.
        }
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();
    }

    public async Task<JsonElement> PredictAsync(int hospitalizationId)
    {
        var h = await _db.Hospitalizations
            .AsNoTracking()
            .Include(x => x.Patient)
            .Include(x => x.Medications)
            .FirstOrDefaultAsync(x => x.Id == hospitalizationId);

        if (h == null)
            throw new KeyNotFoundException("Hospitalization not found.");

        var errors = new List<string>();

        if (!h.Patient.DateOfBirth.HasValue)
            errors.Add("Patient date of birth is missing.");

        if (string.IsNullOrWhiteSpace(h.Patient.Gender))
            errors.Add("Patient gender is missing.");

        if (!h.AdmissionTypeId.HasValue)
            errors.Add("AdmissionTypeId is missing.");

        if (!h.DischargeDispositionId.HasValue)
            errors.Add("DischargeDispositionId is missing.");

        if (!h.TimeInHospital.HasValue || h.TimeInHospital <= 0)
            errors.Add("TimeInHospital must be greater than zero.");

        if (string.IsNullOrWhiteSpace(h.Diag1))
            errors.Add("Primary diagnosis is missing.");

        if (!h.NumLabProcedures.HasValue)
            errors.Add("NumLabProcedures is missing.");

        if (!h.NumProcedures.HasValue)
            errors.Add("NumProcedures is missing.");

        if (!h.NumMedications.HasValue)
            errors.Add("NumMedications is missing.");

        if (!h.NumberDiagnoses.HasValue)
            errors.Add("NumberDiagnoses is missing.");

        if (!h.NumberOutpatient.HasValue)
            errors.Add("NumberOutpatient is missing.");

        if (!h.NumberEmergency.HasValue)
            errors.Add("NumberEmergency is missing.");

        if (!h.NumberInpatient.HasValue)
            errors.Add("NumberInpatient is missing.");

        if (errors.Count > 0)
            throw new ArgumentException(string.Join(" ", errors));

        var birth = h.Patient.DateOfBirth!.Value;
        var age = h.AdmissionDate.Year - birth.Year;

        if (h.AdmissionDate < birth.AddYears(age))
            age--;

        if (age < 0)
            throw new ArgumentException("Date of birth is after admission date.");

        var gender = h.Patient.Gender.Trim().ToLowerInvariant() switch
        {
            "male" or "m" => "male",
            "female" or "f" => "female",
            _ => throw new ArgumentException("Unsupported patient gender.")
        };

        var medications = new Dictionary<string, string>();

        foreach (var medication in h.Medications)
        {
            var name = medication.MedicationName.Trim()
                .ToLowerInvariant()
                .Replace("-", "_")
                .Replace(" ", "_");

            var status = medication.DoseStatus.Trim().ToLowerInvariant();

            if (status is not ("no" or "steady" or "up" or "down"))
                throw new ArgumentException($"Invalid dose status for {name}.");

            medications[name] = status;
        }

        var change = ParseBoolean(h.Change, "Change");
        var diabetesMed = ParseBoolean(h.DiabetesMed, "DiabetesMed");

        var requestId = Guid.NewGuid();

        var request = new
        {
            request_id = requestId,
            hospitalization = new
            {
                age,
                gender,
                admission_type_id = h.AdmissionTypeId,
                admission_source_id = (int?)null,
                discharge_disposition_id = h.DischargeDispositionId,
                time_in_hospital = h.TimeInHospital,
                diag_1 = Normalize(h.Diag1),
                diag_2 = Normalize(h.Diag2),
                diag_3 = Normalize(h.Diag3),
                a1c_result = Normalize(h.A1CResult),
                max_glu_serum = Normalize(h.MaxGluSerum),
                medical_specialty = (string?)null,
                num_lab_procedures = h.NumLabProcedures,
                num_procedures = h.NumProcedures,
                num_medications = h.NumMedications,
                number_diagnoses = h.NumberDiagnoses,
                number_outpatient = h.NumberOutpatient,
                number_emergency = h.NumberEmergency,
                number_inpatient = h.NumberInpatient,
                change,
                diabetes_med = diabetesMed,
                medications
            }
        };

        using var response = await _client.PostAsJsonAsync("/predict", request);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException(content, null, response.StatusCode);

        using var document = JsonDocument.Parse(content);
        var result = document.RootElement.Clone();

        var predictionId = result.GetProperty("prediction_id").GetGuid();

        var link = new PredictionLink
        {
            HospitalizationId = h.Id,
            PredictionId = predictionId,
            RequestId = requestId,
            CreatedAt = DateTime.UtcNow
        };

        _db.PredictionLinks.Add(link);
        await _db.SaveChangesAsync();

        await CachePredictionAsync(hospitalizationId, result);

        return result;
    }

    public async Task<JsonElement?> GetPredictionAsync(Guid predictionId)
    {
        var exists = await _db.PredictionLinks
            .AsNoTracking()
            .AnyAsync(x => x.PredictionId == predictionId);

        if (!exists)
            return null;

        using var response = await _client.GetAsync($"/predictions/{predictionId}");

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        response.EnsureSuccessStatusCode();

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        return document.RootElement.Clone();
    }

    public async Task<JsonElement?> GetLatestPredictionAsync(int hospitalizationId)
    {
        try
        {
            var cached = await _cache.GetStringAsync(GetCacheKey(hospitalizationId));

            if (!string.IsNullOrWhiteSpace(cached))
            {
                using var cachedDocument = JsonDocument.Parse(cached);
                return cachedDocument.RootElement.Clone();
            }
        }
        catch (Exception)
        {
            // Fall back to the database if Redis is unavailable.
        }

        var link = await _db.PredictionLinks
            .AsNoTracking()
            .Where(x => x.HospitalizationId == hospitalizationId)
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync();

        if (link == null)
            return null;

        var result = await GetPredictionAsync(link.PredictionId);

        if (result.HasValue)
            await CachePredictionAsync(hospitalizationId, result.Value);

        return result;
    }

    private static bool? ParseBoolean(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim().ToLowerInvariant() switch
        {
            "yes" or "true" or "1" or "ch" => true,
            "no" or "false" or "0" => false,
            _ => throw new ArgumentException($"Invalid value for {field}.")
        };
    }
}
