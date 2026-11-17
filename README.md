# StartUp Project Portal | Free Spark Edition

This edition uses **Firebase Authentication**, **Cloud Firestore** and **GitHub Pages** only. It does **not** need Firebase Cloud Storage or the Blaze billing plan. Students share controlled links to presentations stored outside Firebase.

## What the portal does

- Private student team workspaces and progress across six project stages
- Research notes and source links
- Project plans and progress journals
- Secure external document and presentation links
- Assigned supervisor feedback
- Administrator team creation, account roles and membership approvals

## What it does not do

- No direct uploads of PDFs, PowerPoint files or images to Firebase
- No documents stored in Firestore
- Google Drive, OneDrive and Canva sharing permissions must be configured **separately**. Firestore permissions do not protect external links.

## Firebase setup | Free Spark plan

1. Open https://console.firebase.google.com/ and create a **new project** for StartUp. Keep the **Spark** plan and do not link a billing account.
2. On Project Overview, click the **Web app** icon `</>` to register a web app. Firebase Hosting is not required. Copy the web app configuration.
3. Open `firebaseConfig.js` and replace the example values with the matching fields. Preserve `export const firebaseConfig = {` at the top. The client web configuration is public; NEVER include any Firebase Admin SDK service account keys.
4. Go to **Authentication > Sign in method** and enable **Email/Password**.
5. Go to **Firestore Database > Create database**. Choose **Standard edition**, an appropriate UK or European region where supported, and **production mode**.
6. Go to **Firestore Database > Rules**, replace the initial rules with the contents of `firestore.rules`, then press **Publish**. Uploading the rules file to GitHub alone does not deploy these rules.
7. Do **not** turn on Cloud Storage. Do **not** upgrade to Blaze. There is no `storage.rules` file in this edition.
8. Go to **Authentication > Settings > Authorised domains** and add the GitHub Pages hostname, for example `yehuda-swu.github.io` (hostname only, no `https://` and no repository path).

## GitHub Pages setup

1. Create a new GitHub repository, for example `startup-project-portal`.
2. Upload the **contents** of this ZIP to the root of the repository. `index.html` must be at the root.
3. Open **Settings > Pages > Deploy from a branch**, then choose `main`, `/ (root)`, and **Save**.
4. Open the URL supplied by GitHub Pages. Use the live HTTPS site, not `index.html` opened from a downloaded ZIP.
5. `preview.html` is a standalone design preview and does not access Firebase.

Suggested GitHub commit message:

    Use free Firebase Spark plan for StartUp project portal

Optional local Git commands:

    git add .
    git commit -m "Use free Firebase Spark plan for StartUp project portal"
    git push origin main

## Create the administrator account

1. On the live website, create an account with a trusted staff email address.
2. Open **Firebase Authentication > Users** and copy the new user's UID.
3. In **Firestore Database > Data > users**, open the document whose ID matches that UID.
4. Edit the `role` string field from `student` to `admin` and save.
5. Sign out and sign back in to access the administrator dashboard.
6. Other staff register normally. The administrator can change their role to `supervisor` and assign them to teams.
7. Students register, request team membership and wait for administrator approval.

The first administrator must be approved manually in Firebase Console; this cannot be done by the registration form.

## How students submit presentations

1. Create a document or presentation in a school approved Google Drive, OneDrive or similar account.
2. Use the document's **Share** menu to invite the team members and the assigned educator by their email addresses. Select Viewer or Commenter as appropriate; avoid public sharing where pupil data is involved.
3. Copy the document link.
4. In the portal, open the team's **Presentations** tab and save the document name and secure link.
5. Educators open the link using their authorised accounts and share feedback in the portal.

This method saves links in Firestore, not the files themselves. If a team grants the wrong permissions in Drive or OneDrive, the portal cannot correct those permissions. Test access with the educator's account.

## Safeguarding and privacy

- Use organisationally approved storage and sharing methods for student work.
- Avoid sharing pupils' documents with "anyone with the link" or on public sites.
- Verify team membership and roles before approving accounts.
- Do not use this prototype to record medical, safeguarding or other sensitive personal details.
- Establish a retention and deletion policy, and review UK GDPR and safeguarding arrangements before inviting pupils.
- Test that unauthorised accounts cannot read team data, and that only assigned supervisors can post feedback.
- The first version does not include version history, automatic archiving, account deletion or notifications.

## Testing checklist

- [ ] Website renders without a persistent spinner
- [ ] Firebase web configuration has been inserted
- [ ] Authentication is enabled and authorised domain added
- [ ] Firestore database created and security rules published
- [ ] First administrator profile has `role = admin`
- [ ] Team and supervisor accounts can be created and assigned
- [ ] Students can request access and receive approval
- [ ] Students can save research, progress updates and their project plan
- [ ] A document link can be shared, opened and removed
- [ ] Supervisors can leave feedback
- [ ] A different team's student cannot access private team records
- [ ] Project remains on Spark and Storage remains disabled

## Included files

| File | Purpose |
| --- | --- |
| `index.html` | Website and loading fallback |
| `styles.css` | Site appearance |
| `app.js` | Portal application code |
| `firebaseConfig.js` | Firebase web app configuration placeholders |
| `firestore.rules` | Firebase database access rules |
| `preview.html` | Illustrative visual preview |
| `favicon.svg` | Browser icon |
| `README.md` | These instructions |

The application has been checked for JavaScript syntax and ZIP contents. Firebase login and database operations must be tested against your project after deployment.
