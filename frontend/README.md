# HospitalCare frontend

React + TypeScript + Vite. Slovak interface for doctors and administrators:

- Login, session restoration, logout and role-based access.
- Patient search, creation and editing; hospitalization forms and history.
- Medications, clinical notes, administrator overview and user management.

## Run with Docker

Configure the root `.env` as described in the [root README](../README.md#run-with-docker), then run from the repository root:

```powershell
docker compose build
docker compose up -d --wait --wait-timeout 180
```

Open http://localhost:5173. Nginx serves the built UI and proxies `/api` to the backend. Stop the stack with `docker compose down`.

## API limits

Risk prediction is unavailable. Medications support viewing and adding only. The API cannot clear previously populated nullable fields through PATCH; forms explain and block this operation.

## Source

`src/app` — routing and layout; `src/api` — HTTP client and DTOs; `src/features` — screens and forms; `src/shared` — UI, styles and formatting. Local tests, reports, build output and environment files are excluded from Git.
