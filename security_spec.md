# Security Specification & Dirty Dozen Audit

## Data Invariants
1. Every document under `/users/{userId}`, `/users/{userId}/private/{docId}`, and `/users/{userId}/kingdom/{docId}` is strictly owned by `request.auth.uid == userId` and embeds `uid == request.auth.uid`.
2. PII (`email`, privacy toggles) is isolated inside `/users/{userId}/private/account` and never readable by non-owners.
3. Username uniqueness is enforced via `/usernames/{usernameLower}` documents keyed by `^[a-z0-9_]{3,24}$` so clients perform point `get()` checks rather than broad collection `list` queries.
4. `createdAt` and `uid` are immutable after creation; all server timestamps must equal `request.time`.
5. No collection allows unauthenticated writes or cross-user `list` scraping.

## Dirty Dozen Adversarial Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/users/{userId}/private/account`
2. Unauthenticated write on `/users/{userId}`
3. Cross-user `get` or `list` on `/users` collection
4. Cross-user write on `/users/{otherUserId}/kingdom/progress`
5. Shadow field injection (`isAdmin: true`, `role: 'superadmin'`) on `/users/{uid}` create or update
6. Forged `uid` mismatch (`data.uid = 'victim_uid'`) under `/users/{attackerUid}`
7. Mutating immutable `createdAt` or `uid` during profile update
8. Client-forged future timestamp (`updatedAt = 2099-01-01`) instead of `request.time`
9. Overlong string / Denial-of-Wallet payload (`kingdomName` > 40 chars or `id` > 128 chars)
10. Overwriting an existing `/usernames/{takenName}` belonging to another UID
11. Unauthenticated overwrite or deletion of `/usernames/{usernameLower}`
12. Invalid `provider` enum injection (`provider: 'admin_bypass'`) on `/users/{uid}`
