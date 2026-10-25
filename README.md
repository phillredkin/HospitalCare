# HospitalCare

Patient and hospitalization management with a Slovak interface for doctors and administrators. Supports patient records, medications, clinical notes and user management. Risk prediction is currently unavailable in the UI.

## Run with Docker

Requires Docker Desktop with Linux containers and Docker Compose v2+.

On first setup, copy `.env.example` to `.env` and fill in the SQL password. Keep the single quotes around the connection string. `.env` is excluded from Git.

```powershell
# From the repository root
docker compose build
docker compose up -d
```

Open http://localhost:5173 and sign in with an existing account.

Compose runs the frontend (Nginx), backend, Redis and ML service. Azure SQL `hospitalcare-db` is external; its firewall must allow your public IP. SQL credentials go only to the backend. Startup does not migrate or seed the database.

```powershell
# Rebuild after changes
docker compose up -d --build
# View status and logs
docker compose ps
docker compose logs --tail 100 frontend mvc
# Stop the stack
docker compose down
```

The backend is also available at http://localhost:5007 and ML at http://localhost:8000. Ports are bound to localhost. This is a local HTTP setup; public hosting requires HTTPS configuration. Stopping the stack keeps Azure SQL data and the backend's Data Protection keys.

For frontend features and API limits, see [frontend/README.md](frontend/README.md).
