# Security Hardening To-Do List

## High Priority
- [ ] Rotate Firebase/Google API credentials and store them outside version control\n  - Frontend sample env now blanks committed keys; rotate and reissue secrets via provider consoles before redeploying
- [x] Remove or disable insecure Firebase test utilities from public hosting
- [x] Lock down Firestore and Storage security rules to authenticated, per-user access
- [ ] Rework Firebase client services to enforce authenticated access and avoid anonymous reads (pending: move storage under users/{uid}/… with proper auth tokens)
- [x] Disable authentication bypass flags and production console logging
- [x] Add invitation-based account provisioning and remove public role assignment
- [x] Require strong JWT secrets and hash persisted refresh tokens
- [x] Add backend dependency lockfile and address npm audit findings\n  - Backend lockfile generated; remaining frontend npm audit items tracked separately.
- [ ] Verify frontend feature usage after access control changes

## Follow-Up
- [ ] Implement admin UI or CLI workflow to manage user invitations
- [ ] Plan Firebase auth integration aligned with backend-issued sessions
- [ ] Monitor upstream fix for xlsx vulnerability and upgrade when released




