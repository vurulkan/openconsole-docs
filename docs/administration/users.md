---
title: "Users"
description: "Local, LDAP and Azure AD accounts."
---

# Users

**Admin → Users** lists every account with its **Source**:

| Source | How the user signs in | Password managed |
|---|---|---|
| Local | username + password stored in OpenConsole (bcrypt) | in OpenConsole |
| LDAP | directory username + directory password | in the directory |
| Azure AD | "Sign in with Microsoft" | in Azure AD / Entra ID |

- **New user** creates an account. When LDAP or Azure AD is enabled it opens a menu:
  - **Local user**: the admin sets the first password.
  - **Import from LDAP…**: the same search-and-import panel as Admin → LDAP ([below](/administration/ldap)).
  - **Azure AD user**: pre-creates a Microsoft account with no password, by the person's UPN or e-mail address (e.g. `jane@example.com`). Their first "Sign in with Microsoft" uses it.

  The main part of the button opens the local-user form directly; the arrow opens the menu. Pick **Groups** right away, and tick **Admin** for full access. New accounts are listed first and highlighted for a moment. Non-admins see nothing until they are in a group with a role ([below](/administration/groups-roles)).
- **The source decides how a password is checked.** Local accounts use their OpenConsole password. LDAP accounts are checked against the directory only, and Azure AD accounts never accept a password (they use the Microsoft button), so a stray local password can't bypass the directory. A failed sign-in always gets the same answer, so the login form doesn't reveal whether an account exists or where it signs in; the failed `user.login` audit event records the reason.
- **Edit** (pencil): admin flag, active / disabled, group membership. A disabled user is signed out on the next request.
- **Reset password** (key icon, **local users only**): sets a new password (min. 8 characters, see `PASSWORD_MIN_LENGTH`) and by default forces a change at next login. All of that user's sessions are signed out, and the reset is audited as `user.reset_password`. LDAP and Azure AD users have no reset here: their password lives in the directory, and a local one would let them bypass it.
- Users change their own password from the header menu. Doing so signs out all their other sessions.
- **Accounts from before 2.13** start out as Local. LDAP accounts switch to LDAP on their next directory sign-in. To fix sources up front (for example for users who haven't signed in since), update the database directly. Stop the app, since the volume is ReadWriteOnce and the image has no `sqlite3`:

  ```bash
  NS=kubernetes-openconsole
  kubectl -n $NS scale deploy/kubernetes-openconsole --replicas=0
  kubectl -n $NS wait --for=delete pod -l app=kubernetes-openconsole --timeout=120s
  kubectl -n $NS run oc-sql --rm -it --restart=Never --image=alpine:3.20 --overrides='{"spec":{"containers":[{"name":"oc-sql","image":"alpine:3.20","stdin":true,"tty":true,"command":["sh","-c","apk add -q sqlite && cp /data/app.db /data/app.db.bak-$(date +%s) && sqlite3 /data/app.db"],"volumeMounts":[{"name":"data","mountPath":"/data"}]}],"volumes":[{"name":"data","persistentVolumeClaim":{"claimName":"kubernetes-openconsole-data"}}]}}'
  ```

  ```sql
  SELECT username, auth_source FROM users ORDER BY auth_source, username;
  -- Azure AD: everyone with a Microsoft sign-in in the audit log (kept LOG_RETENTION_DAYS)
  UPDATE users SET auth_source = 'azure' WHERE auth_source = 'local'
     AND username IN (SELECT DISTINCT user FROM audit_logs WHERE action = 'user.login'
       AND (details LIKE '%"login_method":"azure"%' OR resource_name LIKE 'azure_ad%'));
  -- By name
  UPDATE users SET auth_source = 'azure' WHERE username IN ('jane@example.com');
  UPDATE users SET auth_source = 'ldap'  WHERE username IN ('john', 'ayse.yilmaz');
  .quit
  ```

  Then `kubectl -n $NS scale deploy/kubernetes-openconsole --replicas=1`. The command above keeps a backup next to the database. To turn an account back into a local one, set `auth_source = 'local'` and give it a password with **Reset password**.
- **Delete** removes the account and its group memberships. The last active admin can't be deleted or demoted.
- **Export CSV** (Users and Groups tabs): users with source, admin / active flags and groups; groups with members and roles. Handy for periodic access reviews. Each export is audited as `admin.export`.
