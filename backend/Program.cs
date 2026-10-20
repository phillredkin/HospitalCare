//
using HospitalCare.Web.Data;
using Microsoft.EntityFrameworkCore;
//

//
using Microsoft.AspNetCore.Identity;
using HospitalCare.Web.Models;
//

//
using HospitalCare.Web.Services;
//

//
using HospitalCare.Web.Authentication;
using Microsoft.AspNetCore.Authentication;
//

//
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
//

//
using Microsoft.AspNetCore.Mvc;
//

//
using Microsoft.AspNetCore.DataProtection;
//


var builder = WebApplication.CreateBuilder(args);


//
var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));
//



// ASP.NET Core MVC
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(
        new AutoValidateAntiforgeryTokenAttribute());
});

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();


//
builder.Services
    .AddAuthentication(SessionAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(
        SessionAuthenticationHandler.SchemeName,
        options => { });
//

// Authorization
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Redis Cache
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration =
        builder.Configuration.GetConnectionString("Redis")
        ?? "localhost:6379";

    options.InstanceName = "HospitalCare:";
});

//
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
//

//
builder.Services.AddScoped<AuthService>();
//

//
builder.Services.AddScoped<SessionService>();
//

//
builder.Services.AddScoped<UserService>();
//

//
builder.Services.AddScoped<PatientService>();
//

//
builder.Services.AddScoped<HospitalizationService>();
//

//
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode =
        StatusCodes.Status429TooManyRequests;

    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey:
                context.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});
//

//
// CSRF protection
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";

    options.Cookie.Name = "HospitalCare.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});
//



//
// Data Protection key persistence
var keysPath = builder.Configuration["DataProtection:KeysPath"];

if (!string.IsNullOrWhiteSpace(keysPath))
{
    Directory.CreateDirectory(keysPath);

    builder.Services.AddDataProtection()
        .SetApplicationName("HospitalCare")
        .PersistKeysToFileSystem(
            new DirectoryInfo(keysPath));
}
//

var app = builder.Build();



//
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
//

// HTTP pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();