# Task 6 Report

## 2026-08-03 — Atomic document processing claim

- Added `DocumentService.claimForProcessing(userId, documentId)` using an atomic `updateMany` transition from `pending` or `failed` to `processing`.
- A failed claim returns 404 for missing/cross-user documents and 409 for documents already `processing` or `completed`.
- The process controller now awaits the claim before returning 202, then starts `processDocumentAfterClaim` in the background without a second status check.
- Processing failures still remove partial chunks and set the document to `failed`, allowing a later recovery claim.
- Added a regression test proving that the first of two sequential claims succeeds and the second returns 409.
- Verification: `services/chat` `bun test` passes (16 tests); `bun run typecheck` remains blocked by the existing TS5110 `module`/`moduleResolution` configuration mismatch.
