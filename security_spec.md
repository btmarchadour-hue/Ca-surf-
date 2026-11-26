# Security Specification — Ça Surf ?

## 1. Data Invariants

1. **Private User Isolation**: `/users/{userId}`, `/users/{userId}/customSpots/{spotId}`, and `/users/{userId}/alertLogs/{logId}` are readable and writable strictly by `request.auth.uid == userId`. Zero PII (emails, phones) is stored in any shared collection.
2. **Verified Email Writes & Invite Lookups**: All document mutations and `/crewInvites/{inviteCode}` lookups require `request.auth.token.email_verified == true`.
3. **Master Gate Relational Sync**: Every subcollection read/write under `/crews/{crewId}/members/{memberId}` and `/crews/{crewId}/parkingReports/{memberId}` synchronously verifies membership on parent `/crews/{crewId}` via `get()` / `getAfter()`. Removing a user from `memberIds` immediately revokes all access.
4. **Atomic Invite Capability Proof**: Joining `/crews/{crewId}` requires the joiner's atomic batch to create `/crews/{crewId}/members/{uid}` with `joinedWithCode == existing().inviteCode`, preventing anyone who only knows a `crewId` from self-joining without the secret invite code.
5. **Invite-to-Crew Ownership Binding**: Creating `/crewInvites/{inviteCode}` verifies via `getAfter()` that the target crew is owned by `request.auth.uid` and carries the exact matching `inviteCode`. Creating `/crews/{crewId}` likewise verifies the matching `/crewInvites/{inviteCode}` belongs to the creator and points back to `crewId`.
6. **No Blanket List Queries**: `/users`, `/crewInvites`, `/crews/{crewId}/members`, and `/crews/{crewId}/parkingReports` forbid `list`. Allowed `list` queries on `/crews`, `customSpots`, and `alertLogs` enforce ownership or membership directly against `resource.data` without `get()`.
7. **Strict Action-Based Updates & Immutability**: `uid`, `ownerId`, `id`, `crewId`, `inviteCode`, `joinedWithCode`, and `createdAt` are immutable after creation. Every update passes through `isValid[Entity](incoming())` and named `affectedKeys().hasOnly(...)` action branches.
8. **Temporal & Volumetric Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time`. All strings, numbers, and bounded arrays (`favoriteSpotIds <= 15`, `memberIds <= 25`, head & tail element validation) are constrained.

## 2. Adversarial Payloads (All Must Return PERMISSION_DENIED)

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
15. **Crew Join Without Invite Code (Capability Bypass)**: `UPDATE /crews/crew1` adding `attackerUid` to `memberIds` without an atomic `members/attackerUid` creation carrying `joinedWithCode == existing().inviteCode`.
16. **Rogue Crew Invite Forgery**: `CREATE /crewInvites/ROGUE123` pointing to `victimCrewId` owned by another user.
