# StartUp Project Portal

A private student and supervisor workspace for the StandWithUs UK StartUp Challenge.

Built as a static GitHub Pages site using Firebase Authentication, Cloud Firestore and Cloud Storage. No build command is required.

## Features

* Student accounts with administrator approved team membership.
* Administrator tools to create teams, assign supervisors, approve students and manage account roles.
* Six project stages: Discover, Investigate, Innovate, Present and Review, Refine, Pitch.
* Collaborative StartUp project plan and progress status.
* Research links with notes and citations.
* Team progress journal, milestones and questions.
* PDF, PowerPoint, Word and image uploads up to 15 MB.
* Google Slides and other online presentation links.
* Supervisor feedback visible to the assigned team.
* Team specific Firestore and Storage security rules.

## IMPORTANT: create a NEW Firebase project

We recommend a dedicated project for StartUp, rather than reusing the existing What's the Secret? project. Applying these security rules to another project would replace its current rules and could break its existing application.

### 1. Create the Firebase project

1. Visit https://console.firebase.google.com/ and create a project, for example `startup-project-portal`.
2. Add a web app in Project settings > Your apps.
3. Copy the Firebase web configuration object into `firebaseConfig.js` by replacing the example values. Do not paste an admin SDK key or service account credential.
4. Under Authentication > Sign in method, enable **Email/Password**.
5. Create the default Cloud Firestore database (Standard edition).
6. Enable Cloud Storage for Firebase and create its bucket. **Cloud Storage requires the Blaze pay as you go plan**, even if use stays within the no cost allowance. Enable billing alerts and budgets.
7. Under Authentication > Settings > Authorised domains, add `yehuda-swu.github.io` (or your own GitHub Pages hostname). Add any custom domain too.

### 2. Apply security rules

The Firebase console is where rules become active. Merely uploading `firestore.rules` and `storage.rules` to GitHub will NOT deploy them.

1. Open Firebase console > Firestore Database > Rules.
2. Replace the existing rules with the contents of `firestore.rules`; publish.
3. Open Firebase console > Storage > Rules.
4. Replace the existing rules with the contents of `storage.rules`; publish.
5. When prompted, approve the Firebase Storage permission to use Firestore documents in its rules. This allows private team file access. Reads made by these rules can count towards Firestore billing.

**Do not use open test mode rules in production.**

### 3. Deploy to GitHub Pages

1. Create a new GitHub repository, for example `startup-project-portal`.
2. Upload the contents of this ZIP to the repository root. The file `index.html` must be at the root, not inside a folder.
3. Open GitHub repository Settings > Pages.
4. Choose Deploy from a branch > `main` > `/ (root)` > Save.
5. Your site will be at `https://YOUR_USERNAME.github.io/startup-project-portal/`.
6. Check that your Firebase Authentication authorised domains includes `YOUR_USERNAME.github.io`.

Or use Git commands from your local repository:

```bash
git add .
git commit -m "Launch StartUp project portal with Firebase team workspaces"
git push origin main
```

### 4. Bootstrap the first administrator

1. Open the deployed portal and choose **New student? Create an account**. Register with the administrator's real email address and a strong password.
2. In Firebase Console > Authentication > Users, locate that account and copy its **User UID**.
3. In Firestore Database > Data > `users`, open the document whose ID is that UID.
4. Change only the `role` string field from `student` to `admin`.
5. Sign out and sign in again. The **Admin** dashboard should now be visible.

The first administrator should be a trusted adult member of staff. Do not allow students to hold admin accounts.

### 5. Add supervisors and student teams

1. Supervisors create ordinary accounts from the portal.
2. The administrator opens **Admin** > Registered people and promotes these users to **supervisor**.
3. The administrator creates a team and selects a supervisor or assigns one afterwards.
4. Students create their own accounts and use **Join a team** to request their team's workspace.
5. The administrator approves each request after verifying that the student really belongs to the selected team.
6. Students can then work in their private team workspace, while supervisors can view and comment on their assigned groups.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Main HTML page |
| `styles.css` | Responsive design and layout |
| `app.js` | Application logic and Firebase integration |
| `firebaseConfig.js` | Your public Firebase web app settings |
| `firestore.rules` | Database access permissions |
| `storage.rules` | Private team file access permissions |
| `favicon.svg` | Simple StartUp icon |
| `README.md` | Setup and deployment instructions |

## Access model

* **Administrator:** All project teams, user roles, team assignments and membership approvals.
* **Supervisor:** Read and contribute to assigned workspaces, review submitted files, leave feedback.
* **Student:** Read and contribute to their approved team, post research, update stage progress and share files.
* **Unapproved student:** Can view published team names and request access but cannot read team content.

## Safety, privacy and deployment checks

The portal is designed for pupils. Before actual student use, the organisation should review it for safeguarding, data protection, retention periods, account recovery, access controls and appropriate parental information where applicable.

* Only collect the minimum necessary personal data. This prototype collects name and email address for access management.
* Test account permissions with multiple non privileged student accounts before launch.
* Ask students not to upload personal, medical, safeguarding or other sensitive information.
* Administrators should verify team membership before approval.
* Direct Firebase Storage download URLs can be shared by anyone who receives them, even if Firestore permissions would otherwise prevent access. Do not treat these URLs as permanently private. Consider a server based authenticated download service before storing sensitive material.
* Linked Google Slides or Canva presentations obey the sharing permissions of their own provider, not Firebase. Review their access settings before sharing.
* This first version does not implement notifications, version history, administrator file deletion or automatic account archiving.
* A separate year end retention and deletion policy should be established before deployment.
* Configure Firebase budget alerts and usage limits where available.
* Do not upload secret API keys, service account JSON files or private credentials into a public GitHub repository.

## Validation checklist before inviting students

- [ ] Firebase configuration updated
- [ ] Email/Password authentication enabled
- [ ] Firestore and Storage created
- [ ] Both rulesets published
- [ ] Storage and Firestore rules permission granted
- [ ] GitHub Pages site loads on HTTPS
- [ ] Administrator account bootstrapped
- [ ] Supervisor account promoted and assigned
- [ ] Student access request successfully approved
- [ ] Student cannot open another team's workspace
- [ ] Student can save research, journal updates and project stages
- [ ] Student can upload a test PDF and supervisor can access it
- [ ] Supervisor can post feedback and student can see it
- [ ] Public and unauthorised users cannot access Firestore data

## Technology notes

The app uses the Firebase JavaScript modular CDN at version 13.3.0, released November 2026. Firebase configuration values such as `apiKey` and `projectId` identify the web application; permissions are enforced by Firebase Authentication and the accompanying Firestore and Storage rules, not by hiding the configuration file.
