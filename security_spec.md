# Security Specification — Houle Claire

## 1. Data Invariants

1. **Private User Isolation**: `/users/{userId}`, `/users/{userId}/customSpots/{spotId}`, and `/users/{userId}/alertLogs/{logId}` are readable and writable strictly by `request.auth.uid == userId`. Zero PII (emails, phones) is stored in any shared collection.
2. **Verified Email Writes**: All document mutations require `request.auth.token.email_verified == true`.
3. **Master Gate Relational Sync**: Every subcollection read/write under `/crews/{crewId}/members/{memberId}` synchronously verifies membership on parent `/crews/{crewId}` via `get()` / `getAfter()`. Removing a user from `memberIds` immediately revokes all access.
4. **No Blanket List Queries**: `/users`, `/crewInvites`, and `/crews/{crewId}/members` forbid `list`. Allowed `list` queries on `/crews`, `customSpots`, and `alertLogs` enforce ownership or membership directly against `resource.data` without `get()`.
5. **Strict Action-Based Updates & Immutability**: `uid`, `ownerId`, `id`, `crewId`, `inviteCode`, and `createdAt` are immutable after creation. Every update passes through `isValid[Entity](incoming())` and named `affectedKeys().hasOnly(...)` action branches.
6. **Temporal & Volumetric Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time`. All strings, numbers, and bounded arrays (`favoriteSpotIds <= 15`, `memberIds <= 25`) are constrained.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)

1. **Cross-User Profile Read**: `GET /users/victimUid` authenticated as `attackerUid`.
2. **Shadow Field Injection on Profile Create**: `CREATE /users/attackerUid` with extra `"isAdmin": true` ghost field.
3. **Unverified Email Write**: `CREATE /users/attackerUid` with `email_verified: false`.
4. **Client Timestamp Forgery**: `CREATE /users/attackerUid` with `createdAt` set to a past client timestamp (`!= request.time`).
5. **Array Overflow (Denial of Wallet)**: `UPDATE /users/attackerUid` with 20 spot IDs in `favoriteSpotIds` (`> 15`).
6. **Regex Bypass on Alert Time**: `UPDATE /users/attackerUid` with `alertTime: "29:99"`.
7. **Invite Scraping**: `LIST /crewInvites` as an authenticated user trying to enumerate invite codes.
8. **Crew Hijack (Owner Spoofing)**: `UPDATE /crews/crew1` attempting to modify `ownerId` or `inviteCode`.
9. **Unauthorized Crew Member Read (Master Gate)**: `GET /crews/crew1/members/friend1` by a user not listed in `crews/crew1.memberIds`.
10. **Crew Member Impersonation**: `UPDATE /crews/crew1/members/friend1` by another crew member (`friend2`) attempting to overwrite `friend1`'s planned spot.
11. **Value Poisoning on Allowed Key**: `UPDATE /crews/crew1/members/friend1` setting `statusNote` to a 500-character string (`> 120`).
12. **Immutable Alert Log Tampering**: `UPDATE /users/user1/alertLogs/log1` attempting to alter `score` or `bestSpotName`.
13. **Parking Report Non-Member Read / Master Gate Bypass**: `GET /crews/crew1/parkingReports/friend1` by a user not in `crews/crew1.memberIds`.
14. **Parking Report Impersonation & Enum Poisoning**: `CREATE /crews/crew1/parkingReports/friend1` by `friend2`, or with invalid `verdict: "epic"` or `note` > 200 chars, or `LIST /crews/crew1/parkingReports`.

