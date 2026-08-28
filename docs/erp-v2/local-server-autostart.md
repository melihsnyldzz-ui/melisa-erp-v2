# Local Server Autostart

This Windows computer can keep the Melisa ERP services available while the signed-in server user is active.

## Managed services

- ERP web admin on port 5173
- ERP API on port 4100
- WhatsApp CRM API on port 4200
- Docker Desktop and the local Evolution stack
- CRM PostgreSQL and Redis containers

## Behavior

- When Task Scheduler access is available, `MelisaERP-Startup` and `MelisaERP-Watchdog` are installed.
- Without administrator access, an HKCU startup entry launches a hidden supervisor after the Windows user signs in.
- The supervisor checks the stack every two minutes.
- A missing service is restarted in a hidden window.
- A listening but unhealthy port is not overwritten by a second process.
- A mutex prevents two watchdog runs from overlapping.
- Logs are stored under `%LOCALAPPDATA%\MelisaERPServer\logs`.
- AC sleep and hibernation timeouts are set to `0` so the server does not suspend while plugged in; display timeout is unchanged.

## Commands

Install:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-erp-server-autostart.ps1
```

Status:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\erp-server-status.ps1
```

Remove:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-erp-server-autostart.ps1 -Remove
```

Because the current Windows session is not elevated, the tasks run for the signed-in Windows user. For operation before any user signs in, install the same watchdog later as a Windows service from an elevated administrator session.
