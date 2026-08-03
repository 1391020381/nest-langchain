# Chat service

Chapter 5 chat API with JWT authentication, PostgreSQL/pgvector document
storage, semantic search, persisted conversations, and SSE processing events.
The service listens on `http://localhost:4001` by default.

## Local runbook (Windows PowerShell)

Run these commands from the repository root.

1. Start PostgreSQL with the pgvector extension:

   ```powershell
   docker compose -f infra/compose/compose.yaml up -d postgres
   docker compose -f infra/compose/compose.yaml ps postgres
   ```

2. Create the service environment file and review its values:

   ```powershell
   Copy-Item services/chat/.env.example services/chat/.env
   ```

   The defaults connect to the Compose database on `localhost:5432` and use
   port `4001`. Set a non-development `JWT_SECRET`. Chat generation also needs
   a valid `OPENAI_API_KEY`; set `OPENAI_BASE_URL` and `OPENAI_MODEL` when
   using an OpenAI-compatible provider. Upload, embedding, and search can run
   without an OpenAI key.

3. Install dependencies, generate Prisma Client, and apply migrations:

   ```powershell
   bun install
   bun run --cwd services/chat prisma:generate
   bun run --cwd services/chat prisma:migrate
   ```

4. Start the API:

   ```powershell
   bun run dev:chat
   ```

   Verify it from another terminal:

   ```powershell
   curl.exe --fail-with-body http://localhost:4001/health
   ```

To stop PostgreSQL, run:

```powershell
docker compose -f infra/compose/compose.yaml down
```

Add `-v` only when you intentionally want to delete the database volume.

## Docker Compose (`chat` service)

The Compose `chat` container does **not** run Prisma migrations on startup. Apply
migrations to the database **before** starting the full stack:

```powershell
docker compose -f infra/compose/compose.yaml up -d postgres
bun run --cwd services/chat prisma:generate
bun run --cwd services/chat prisma:migrate
docker compose -f infra/compose/compose.yaml up -d chat
```

If you skip migration, the chat container may start but API calls that touch the
database will fail until the schema exists.

## Acceptance smoke test

With PostgreSQL migrated and the chat service running:

```powershell
powershell -ExecutionPolicy Bypass -File services/chat/scripts/ch5-smoke.ps1
```

The script registers a unique user, logs in, uploads a temporary text file,
waits for processing, searches it, creates a conversation, and sends a chat
message. It accepts `-BaseUrl`, `-Email`, `-Password`, `-FilePath`, and
`-ProcessingTimeoutSeconds`. A chat-only failure is reported as a warning
because it is expected when the service has no valid OpenAI configuration;
all earlier stages must still succeed.

## Manual curl examples

The examples below use PowerShell plus the Windows `curl.exe` binary.

```powershell
$base = "http://localhost:4001"
$email = "ch5-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.com"
$password = "SmokePass123!"

curl.exe --fail-with-body -X POST "$base/api/auth/register" `
  -H "Content-Type: application/json" `
  --data-raw "{`"email`":`"$email`",`"password`":`"$password`",`"name`":`"Ch5 User`"}"

$login = curl.exe --fail-with-body -X POST "$base/api/auth/login" `
  -H "Content-Type: application/json" `
  --data-raw "{`"email`":`"$email`",`"password`":`"$password`"}" |
  ConvertFrom-Json
$token = $login.accessToken

$document = curl.exe --fail-with-body -X POST "$base/api/documents/upload" `
  -H "Authorization: Bearer $token" `
  -F "file=@C:\path\to\notes.txt" | ConvertFrom-Json

curl.exe --fail-with-body -X POST "$base/api/documents/$($document.id)/process" `
  -H "Authorization: Bearer $token"

curl.exe --fail-with-body "$base/api/documents/$($document.id)" `
  -H "Authorization: Bearer $token"

curl.exe --fail-with-body -X POST "$base/api/search" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  --data-raw '{ "query": "pgvector semantic search", "topK": 3 }'

$conversation = curl.exe --fail-with-body -X POST "$base/api/conversations" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  --data-raw '{ "title": "Chapter 5 test" }' | ConvertFrom-Json

curl.exe --fail-with-body -X POST `
  "$base/api/conversations/$($conversation.id)/chat" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  --data-raw '{ "input": "Summarize my uploaded document." }'
```

Document processing is asynchronous. Wait until the document `status` is
`completed` before searching. To observe processing notifications, connect
with `curl.exe -N "$base/api/sse" -H "Authorization: Bearer $token"`.
