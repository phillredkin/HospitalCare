
using HospitalCare.Web.Dtos;
using HospitalCare.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalCare.Web.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly UserService _userService;

    public UsersController(UserService userService)
    {
        _userService = userService;
    }

    // GET /api/users
    [HttpGet]
    public async Task<ActionResult<List<UserResponseDto>>> GetAll()
    {
        var users = await _userService.GetAllAsync();

        return Ok(users);
    }

    // GET /api/users/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserResponseDto>> GetById(int id)
    {
        var user = await _userService.GetByIdAsync(id);

        if (user == null)
        {
            return NotFound(new
            {
                message = $"Користувача з ID {id} не знайдено."
            });
        }

        return Ok(user);
    }

    // POST /api/users
    [HttpPost]
    public async Task<ActionResult<UserResponseDto>> Create(
        [FromBody] CreateUserRequestDto request,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        // The antiforgery filter validates this header before the action executes.
        _ = csrfToken;

        try
        {
            var user = await _userService.CreateAsync(request);

            return CreatedAtAction(
                nameof(GetById),
                new { id = user.Id },
                user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }


    // PATCH /api/users/{id}
    [HttpPatch("{id:int}")]
    public async Task<ActionResult<UserResponseDto>> Update(
        int id,
        [FromBody] UpdateUserRequestDto request,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        // The antiforgery filter validates this header before the action executes.
        _ = csrfToken;

        try
        {
            var user = await _userService.UpdateAsync(id, request);

            if (user == null)
            {
                return NotFound(new
                {
                    message = $"Користувача з ID {id} не знайдено."
                });
            }

            return Ok(user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }



}
