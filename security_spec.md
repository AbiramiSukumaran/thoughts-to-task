# Firestore Security Specification - Thoughts to Task

## 1. Data Invariants
1. **User Isolation**: A user can only read, create, update, or delete their own data under the `/users/{userId}` paths.
2. **Strict Structure**: Incoming thoughts and tasks must comply with strong structural type enforcement (no extra "Ghost Fields", size boundaries on string properties, timestamp synchronization with server time).
3. **Verified Email Mandate**: User accounts must be verified with Google email verification (`email_verified == true`) to complete writes, protecting against spoofing.
4. **Action-Based Updates**: Updating a task or thought is limited to predefined, isolated updates (e.g., status changes, subtask edits, or metadata updates) using `affectedKeys().hasOnly()` gates.
5. **Timestamp Honesty**: The `createdAt` property is immutable after document creation, and all `updatedAt` operations are strictly bound to the authenticating server's timestamp (`request.time`).

---

## 2. The "Dirty Dozen" Payloads (Attacks designed to break laws)

1. **Spoofed Owner Payload**: Trying to create a raw thought in user B's collection under `/users/userB/thoughts/thought1` with authenticated credentials of User A.
2. **Rogue verifiedEmail Bypass**: Trying to perform a task write when `auth.token.email_verified` is false (e.g., fake unregistered email).
3. **Ghost Field Injection (Shadow Update)**: Appending `isAdmin: true` or `isPremium: true` to `/users/{userId}` or `/users/{userId}/tasks/{taskId}` payload.
4. **Id Poisoning Attack**: Submitting an outrageously long document ID or one containing special escape characters e.g. `../../bad-document` for `{taskId}`.
5. **Immutability Violation (createdAt Mutation)**: Attempting to modify `createdAt` to an old history date inside an update task request.
6. **Value Poisoning (Task Priority)**: Modifying task priority to an illegal string like `"critical-overload"` instead of `"low" | "medium" | "high"`.
7. **Size Exhaustion (Denial of Wallet)**: Setting `rawText` of a thought to a 5MB payload or `description` of a task exceeding the size limits to deplete database storage.
8. **Unbounded Subtask Array Explosion**: Attempting to insert an array of 5,000 subtasks into a task document.
9. **Blanket Query Scraping**: Submitting a wide list query matching `/users/{userId}/tasks` without limiting queries to the currently authenticated user's ID.
10. **State Shortcutting (Terminal Lock Bypass)**: Trying to update properties on an already `completed` or `archived` task.
11. **Self-Assigned Admin privileges**: Attempting to create an admin entry or update a field to assign oneself administrative roles.
12. **Out-of-Sync Timestamp Injector**: Attempting to bypass `request.time` checks by sending a client-side hardcoded timestamp in `updatedAt`.

---

## 3. The Security Rule Test Runner Outline

The following rules will be deployed and tested through Firebase Emulator and integrated Jest/Vitest rule checkers to ensure that each malicious query is strictly rejected with `PERMISSION_DENIED`.

- **Test A:** Authentication validation (Ensures only verified sign-ins allowed).
- **Test B:** User Profile and Data Path isolation (Ensures `userId == auth.uid`).
- **Test C:** Key footprint strictness (Prevents Ghost Field injection).
- **Test D:** Action validation and Value boundaries.
