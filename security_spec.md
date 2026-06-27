# Security Specification for Almox Pro

## 1. Data Invariants
- **Identity Integrity**: `users/{uid}` can only be read/written by the user with that UID or a Master.
- **Tenant Isolation**: Users can only access data under `/organizations/{orgId}` if their `users/{uid}` document has the same `orgId`.
- **Master Privilege**: Users listed in `masters/` or with the email `esdrasgomes547@gmail.com` have full access.
- **Immutable IDs**: Document IDs must follow a strict pattern.
- **Type Safety**: All fields must match their defined types in `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a user profile with a different UID.
2. **Cross-Tenant Read**: User from Org A tries to list inventory from Org B.
3. **Cross-Tenant Write**: User from Org A tries to update a shipment in Org B.
4. **Master Bypass**: Unauthorized user tries to add themselves to the `masters` collection.
5. **Unauthorized Premium Write**: Non-premium user (and non-master) tries to write to an organization.
6. **Shadow Update**: Adding a field not defined in the schema (e.g., `isVerified: true`).
7. **ID Poisoning**: Using a very long or invalid character string as a document ID.
8. **PII Leak**: Non-master/non-owner trying to read another user's PII.
9. **State Shortcutting**: Updating a shipment status directly to a terminal state without proper fields. (If applicable).
10. **Resource Exhaustion**: Sending a payload with a 1MB string field.
11. **Orphaned Record**: Creating a movement for a non-existent inventory item.
12. **Timestamp Spoofing**: Sending a client-side `updatedAt` instead of `serverTimestamp()`.

## 3. Test Runner (Conceptual)
A `firestore.rules.test.ts` will be implemented to verify these scenarios using the Firebase Rules Unit Testing library.
