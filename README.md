# UHS V0.2 — GitHub + Render Preview

## Publish the source
Create a new GitHub repository (e.g. `uhs-social`). Upload the **contents of this folder** to the repository root, not the enclosing folder. Keep the repository private if possible. Never upload `data/accounts.json`.

## Connect Render
Create a new Render **Web Service**, choose the `uhs-social` GitHub repository. Choose the `main` branch and **Node** runtime. Root Directory: blank. Build Command: `npm install`. Start Command: `npm start`. Health check: `/healthz`. Free instance is sufficient to test the visual preview.

Render allocates its own `PORT`. The server binds `0.0.0.0` by default in preview mode. After Render says Live, open `https://<your-service>.onrender.com/UHS/`.

## Critical guardrail
The Render preview **intentionally disables registration and login**. The original JSON account store is unsuitable for the public Internet or Render's ephemeral filesystem. The preview can display the UI safely, but does not create or retain actual accounts.

For local-only testing on Windows: double-click `START_UHS.bat`. It sets `UHS_LOCAL_ACCOUNTS=1`, enabling test registrations and numeric IDs from 1000. Use test-only passwords.

Before public registration: adopt a permanent transactional database (e.g. PostgreSQL), ensure atomic allocation of member IDs from 1000, add email verification, password reset, secure production session storage, CSRF protection, HTTPS-only cookies, deployment backups, and security review. Do not set `UHS_LOCAL_ACCOUNTS=1` on Render.

## Custom domain
`truth-party.com/UHS` requires a path-based reverse proxy or routing configuration on the existing truth-party.com host. Merely adding `truth-party.com` as a Render custom domain would route the whole hostname to Render. Use the temporary `onrender.com/UHS/` URL until the existing domain server is configured.
