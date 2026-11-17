# StartUp Project Portal | Team member names and cohort administrators

This update retains the existing Firebase project, student accounts, team work, GitHub Pages website and free Spark plan. It keeps the separate Waze and Netafim administrator roles and adds team member names to the creation and team workspace forms.

## New: add names when creating a team

1. Open **Admin → Create a team**.
2. Enter the team name, StartUp group and programme year.
3. Under **Team member names (optional)**, add one student name on each line.
4. Complete the remaining fields and click **Create team**.
5. The names appear in the private team workspace and in the team assignments table.
6. To correct names later, open the team workspace, go to **Overview → Team members**, edit the list and click **Save team members**.

This list can contain up to 12 names. It is a private planning register, not a list of authenticated accounts. A student still needs to register and be approved to join their team. Names are stored on the protected Firestore team document, **not** in the public team directory. Existing teams without a names list will continue to work. Only the main administrator or the administrator of that team's cohort can edit the list. Do not include extra personal information about pupils in this field.

**You must republish the included `firestore.rules` in Firebase**, because creating a team now stores an additional `memberNames` field. Uploading the code to GitHub alone is not enough. Nothing needs to change in `firebaseConfig.js`. No Storage or Blaze plan is needed.

## Roles

| Account role | Assigned to | Permissions |
| --- | --- | --- |
| `admin` | Main administrator | Manage both cohorts, all teams, approvals and account roles |
| `waze_admin` | Eden, edeni@standwithus.com | Create Waze teams, review Waze research and presentations, approve Waze student requests, give feedback |
| `netafim_admin` | Eliana, egarfunkel@standwithus.com | Same functions for Netafim only |
| `student` | Students | Access their approved teams only |
| `supervisor` | Other educators if needed | Access assigned teams |

Only the main administrator can change other users' roles. Cohort administrator access restrictions are enforced by Firestore rules, not only by hiding information in the website.

## Install the new version

1. Download and extract the new ZIP.
2. Open the **existing GitHub repository** for your StartUp Portal.
3. Select **Add file → Upload files** and upload all of the **individual files** inside the extracted folder to the repository root. Replace the old versions. Do not upload the enclosing folder or the ZIP itself.
4. Commit with the message: `Add team member names to StartUp team creation`.
5. In Firebase, open **Firestore Database → Rules** for the existing `startup-project-portal` project.
6. Open the **new** `firestore.rules` file with Notepad. Copy all its contents into the Firebase rules editor and click **Publish**. Uploading the rules file to GitHub does not activate the rules.
7. Open the live website and press **Ctrl + Shift + R** to refresh.

**Important:** The existing `firebaseConfig.js` already contains the same Firebase web configuration. Do not edit it. You do not need Firebase Cloud Storage or the Blaze billing plan. No database reset is needed.

## Assign the staff accounts

1. Eden and Eliana register using their own staff email addresses if they have not done so already. Verify their identities before granting administrator permissions.
2. Sign into the website as the existing main administrator and select **Main Admin**.
3. In **Registered people**, change Eden's role to **Waze Admin**.
4. Change Eliana's role to **Netafim Admin**.
5. Ask both staff members to sign out and sign in again.

The new Firestore rules reserve Waze Admin for `edeni@standwithus.com` and Netafim Admin for `egarfunkel@standwithus.com`. The regular `admin` role has unrestricted programme access and should remain with the main administrator.

## Assign existing teams to a cohort

Older team records may lack a `stream` field. In **Main Admin → Team assignments**, teams marked **Not assigned** have an **Assign cohort** selection. Choose either **StartUp Waze** or **StartUp Netafim** for each team.

This updates the existing team record, team directory and any previous membership requests. It retains research, presentations and other existing project information. Check the assignment before confirming. The current interface cannot change an already assigned cohort. A mistaken assignment requires a correction in Firebase Console by the main administrator.

New teams created by Eden automatically belong to Waze. New teams created by Eliana automatically belong to Netafim. The main administrator can choose either cohort when creating a team.

## Verify access before inviting students

- Main Admin sees both cohorts and can change roles.
- Eden sees only Waze teams and requests, and can review and give feedback on Waze work.
- Eliana sees only Netafim teams and requests, and can review and give feedback on Netafim work.
- Eden cannot read private Netafim team work; Eliana cannot read private Waze team work.
- Students can open only teams where they are approved members.
- Existing research, project plans and shared document links still work.
- Cloud Storage remains disabled and the project stays on Spark.

Keep student document links restricted in Google Drive or OneDrive as Firestore permissions do not control external sharing. Review safeguarding, UK GDPR and permissions before pupils use the system.

## Files and technical notes

`app.js` contains the new user roles and cohort filtered dashboards. `firestore.rules` enforces access. `index.html` includes cache version updates. `firebaseConfig.js` retains the existing settings. `logo.png`, `styles.css`, `favicon.png`, and `preview.html` retain the current StartUp design.

The new team and team directory documents include `stream: 'waze'` or `stream: 'netafim'`, and new join requests are tagged with the same stream. The main administrator can assign the stream to legacy teams without resetting the database.

JavaScript syntax and administrator page rendering were checked locally with simulated users. Live Firebase login and access rules still require testing after publication.

Suggested Git commands if working locally:

    git add .
    git commit -m "Add team member names to StartUp team creation"
    git push origin main
