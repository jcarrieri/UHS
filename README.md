# UHS V0.3 — Welcome Splash Screen + Render Preview

This update adds the newly designed **Universal Healthcare Social** splash screen at `/UHS/`, with two working navigation areas on the illustration:

- **Enter UHS** → `/UHS/?view=account` (existing registration/login preview)
- **Learn More** → `/UHS/?view=learn` (platform information)

On narrow/mobile screens, visible accessible navigation buttons appear beneath the image.

## Deploy with GitHub + Render

1. Extract the ZIP and upload **all files and folders inside** to the **root** of your GitHub `UHS` repository, replacing existing files with the same name. Keep the `public` folder intact.
2. Commit the changes to the branch connected to your UHS Render Web Service (`main`).
3. Render should automatically redeploy if automatic deployments are enabled; otherwise click **Manual Deploy → Deploy latest commit**.
4. Visit `https://YOUR-RENDER-SERVICE.onrender.com/UHS/`. Use your actual Render host.

The desired `https://truth-party.com/UHS` URL requires additional routing on your existing domain hosting.

## Important: preview only

Public registration and login remain **disabled** by default (unless `UHS_LOCAL_ACCOUNTS=1` is explicitly set, which should be used for LOCAL testing ONLY). This prevents storing real account data on Render's ephemeral filesystem. The durable production database, email verification, and production security remain future work.

Member IDs will start at integer 1000 when permanent account registration is implemented.

## Local test

Run `START_UHS.bat` on Windows with Node.js installed, then visit `http://localhost:8082/UHS/`.
