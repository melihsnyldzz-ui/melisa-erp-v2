# Local Passwordless Admin Login

Date: 2026-07-07

## Purpose

Melisa ERP can be opened quickly on the local desktop without typing the admin password every time.

This is a local convenience feature. It is not a production authentication model.

## Safety Rules

- Production mode always rejects passwordless admin login.
- The normal username/password login stays available.
- The local passwordless endpoint returns an access token only.
- It does not create a refresh token.
- It does not update `users.last_login_at`.
- It does not write to SQL Server.
- It only works when the backend flag is enabled.

## Backend Flag

Set this for local API usage:

```text
MELISA_LOCAL_PASSWORDLESS_LOGIN=true
```

If this value is missing or `false`, the backend returns:

```text
AUTH_LOCAL_PASSWORDLESS_DISABLED
```

## Web Admin Flag

Set this for the web-admin login button:

```text
VITE_LOCAL_PASSWORDLESS_LOGIN=true
```

If this value is missing or `false`, the button is hidden and only normal username/password login is shown.

## Electron Behavior

The Electron desktop launcher enables local passwordless login by default for the local stack it starts.

To disable it while launching Electron:

```text
MELISA_LOCAL_PASSWORDLESS_LOGIN=false
```

If the API is already running before Electron starts, Electron cannot change that existing API process environment. Restart the API through Electron or start the API with the backend flag enabled.

## Endpoint

```text
POST /api/auth/local-passwordless-admin
```

The endpoint logs in as the active `admin` user only when local passwordless login is enabled and the API is not running in production mode.
