# StartUp Project Portal | Direct file uploads

**This package builds on the existing StartUp portal.** It retains the StartUp logo, the Waze and Netafim administrator roles, team member names, existing Firebase accounts and project data. Firebase remains on its free Spark plan.

## New file features

Students and authorised staff can:

- Upload PDF, Word, PowerPoint, Excel, text and image files up to **20 MB each**, directly in **Team workspace → Files**.
- Download team files using temporary private links.
- Remove files they uploaded, while the relevant staff can remove files within their authorised cohort.
- Continue sharing Google Drive, OneDrive and other secure HTTPS document links.
- See the following message next to the uploader: **“For files larger than 20MB please use WeTransfer”** with a link to https://wetransfer.com/.
- Copy the WeTransfer transfer link into **Share an existing document link** below the uploader.

**Age requirement:** WeTransfer says its service is for people aged 16 or over. For StartUp students under 16, the relevant supervisor (Eden for Waze or Eliana for Netafim) should handle any WeTransfer upload, rather than asking the pupil to register or upload directly. Check https://wetransfer.com/explore/legal/privacy and https://wetransfer.com/explore/legal/terms for the current provider requirements.

**Important:** WeTransfer is a separate service. An external transfer link does not inherit the portal's access controls and may expire. For pupil work, use a password or recipient restriction where appropriate, communicate it securely, and follow your organisation's safeguarding and data protection policy. Do not upload sensitive pupil information to third party storage unless approved by the organisation.

## Why a second free service is necessary

Firebase Cloud Storage requires the Blaze billing plan, which this portal deliberately avoids. To upload files directly and privately, the new portal uses **Supabase Storage**, with a **private bucket** and an **Edge Function** that verifies existing Firebase team access before issuing signed file upload or download links.

Supabase's free plan currently includes approximately **1 GB of total file storage**. Free usage and transfer limits can change; check the Supabase dashboard. The uploader deliberately imposes a smaller **20 MB file limit**. If your total storage is exhausted, use a secure external document link instead or remove old files.

Only the two public Supabase connection values go into `storageConfig.js`. Do not put a service role key or another server secret in website files or in GitHub.

## Part A: Set up Supabase free storage

1. Go to https://supabase.com/ and create a free account and a **new project** for the StartUp Portal. Keep the Free plan.
2. In the project dashboard, open **Storage** and select **New bucket**.
3. Name the bucket exactly `startup-team-files`.
4. **Keep Public bucket OFF.** This is essential. The portal serves files through temporary signed download links and does not use public file URLs.
5. Set the bucket file size limit to **20 MB** if the dashboard offers this option. Do not restrict MIME types unless you have tested all the file formats that pupils may use.
6. In **Project Settings → API Keys** (menu wording may vary), copy the **Project URL** and **publishable** or legacy **anon** key. These are public credentials, not a service role key.
7. Open `storageConfig.js` in Notepad. Replace `https://PASTE_PROJECT_REF.supabase.co` with the Project URL and `PASTE_SUPABASE_PUBLISHABLE_KEY` with the publishable / anon key. Keep the two bucket and function names unchanged. Save the file.

## Part B: Deploy the file permission service

An Edge Function is required so the Storage bucket remains private. It does not use Firebase Cloud Functions or Blaze.

1. In Supabase, open **Edge Functions → Deploy a new function**. Use the name `startup-files`.
2. For a dashboard deployment, choose the code editor and paste the full contents of `supabase/functions/startup-files/index.ts`. Deploy the function.
3. In the function's settings, **turn off built in JWT verification** (sometimes displayed as **Verify JWT with legacy secret**). This is needed because the portal sends **Firebase** ID tokens, not Supabase ID tokens. **The function still authenticates every operation** by sending the token to Firestore, which applies your Firebase security rules, before issuing a file link. Do not remove that authentication code.
4. Supabase Edge Functions normally receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically as runtime secrets. Verify these are available to the function. Never copy either secret key into public GitHub files. If the platform has changed the environment settings, follow its current Edge Function secrets instructions.
5. Ensure **Firestore Rules** from the new `firestore.rules` file are published in the `startup-project-portal` Firebase project. These rules govern file metadata and team permissions.
6. If the browser reports a network or CORS error, check that the live site's origin is `https://yehuda-swu.github.io`, or update `ALLOWED_ORIGINS` in the server function and redeploy if using a different domain.

**Alternative using the Supabase CLI:** After linking the Supabase project, run `supabase functions deploy startup-files --no-verify-jwt`. The included `supabase/config.toml` has `verify_jwt = false` as well. These settings only disable the Supabase JWT gateway check; the Edge Function's Firebase permission checks remain mandatory.

## Part C: Update GitHub Pages and Firebase

1. Extract this ZIP.
2. Enter the extracted folder. Upload the individual website files from the top level of the folder to the **root of your existing GitHub repository**. Include `storageConfig.js`, `app.js`, `styles.css`, `index.html`, `firebaseConfig.js`, images and `preview.html`.
3. The `supabase/functions/startup-files/index.ts` file is for your Supabase Edge Function deployment. It may remain in GitHub as source code, but it is **not** deployed by GitHub Pages.
4. Commit with: `Add secure file uploads and WeTransfer guidance`.
5. Open Firebase → **Firestore Database → Rules**, paste the entire contents of this package's `firestore.rules`, and click **Publish**.
6. Return to your portal and press **Ctrl + Shift + R**.

The existing `firebaseConfig.js` is already configured for your current Firebase project. You do **not** need to replace it, pay for Blaze or recreate the database.

## Part D: Verify before letting pupils use it

1. Log in as Main Admin and open an existing approved team.
2. Select **Files**. Confirm the 20 MB limit and WeTransfer link are visible.
3. Upload a small PDF as a test using an approved team account. Confirm it appears in the list and can be downloaded.
4. Try a file larger than 20 MB. The portal should display the WeTransfer guidance instead of uploading it.
5. Sign in as a member of a different team and confirm they cannot open the private file.
6. Sign in as Eden (Waze Admin) and verify access only to Waze team files. Repeat for Eliana (Netafim Admin).
7. Delete the test PDF and confirm it disappears. Try a private document link and an external WeTransfer link, noting that the WeTransfer link will expire.

**Security:** Supabase and Firestore permissions must be tested live before real pupils upload files. Local syntax and browser preview tests do not prove live cloud permissions.

## Troubleshooting

- **Direct uploads are not connected yet:** Check `storageConfig.js` and refresh. The Firebase and document link features should still work.
- **401 from function:** Check the function has legacy JWT verification disabled, that you are logged into Firebase, and that the function validates your team access.
- **403:** Check Firestore rules, approved team membership, and matching Waze / Netafim permissions.
- **A file fails to upload:** Check the bucket is private and named correctly, the file is under 20 MB, and the Edge Function is deployed.
- **A stored file disappears from the team's list:** Check that Firestore rules were published and the upload record was saved successfully.
- **WeTransfer link no longer works:** Transfers expire separately from the portal. Reupload or use a school approved persistent Drive or OneDrive link.

## Files

- `app.js`: existing portal plus direct upload / download flow
- `storageConfig.js`: public Supabase URL and public key placeholders
- `supabase/functions/startup-files/index.ts`: permission checking file gateway
- `supabase/config.toml`: Edge Function deployment option
- `firestore.rules`: updated Firebase rules for private file metadata
- `index.html`, `styles.css`, `preview.html`, and images: existing StartUp site design and upload guidance
