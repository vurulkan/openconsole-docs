---
title: "Groups, roles and permissions"
description: "User → Group → Role → Permission."
---

# Groups, roles and permissions

Access is **User → Group → Role → Permission**. Admins bypass all of it.

- **Role**: a named set of permissions, e.g. `payments-developer`.
- **Permission**: cluster (one, or **All clusters**) + namespace + resource + action. The full list is in [Application permissions](/reference/permissions).
- **Group**: a set of users; a group gets one or more roles.

Typical flow:
1. **Admin → Roles → New role**, then **Add permissions**. Pick the cluster, one or more namespaces (multi-select with filter, "Select N matching"), and a template (Viewer / Developer / SRE / Admin) or individual actions. **Copy from role** clones another role's grants. Existing grants are shown as cards per namespace and can be edited in place.
2. **Admin → Groups → New group**, then assign the role(s).
3. Add users to the group (from the group, or from Admin → Users).

Changes apply on the user's next request; no sign-out is needed. A user only sees namespaces where they have at least one permission on their current cluster.
