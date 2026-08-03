param(
  [string]$BaseUrl = "http://localhost:4001",
  [string]$Email = "ch5-smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.com",
  [string]$Password = "SmokePass123!",
  [string]$FilePath,
  [int]$ProcessingTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"

function Invoke-CurlJson {
  param(
    [string]$Method,
    [string]$Url,
    [string]$Token,
    [string]$Body,
    [string[]]$ExtraArguments = @()
  )

  $arguments = @("--silent", "--show-error", "--fail-with-body", "-X", $Method)
  if ($Token) {
    $arguments += @("-H", "Authorization: Bearer $Token")
  }
  if ($Body) {
    $arguments += @("-H", "Content-Type: application/json", "--data-raw", $Body)
  }
  $arguments += $ExtraArguments
  $arguments += $Url

  $response = & curl.exe @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "HTTP request failed ($Method $Url, curl exit $LASTEXITCODE): $response"
  }
  if (-not $response) {
    return $null
  }
  return $response | ConvertFrom-Json
}

Write-Host "Checking chat service at $BaseUrl ..."
Invoke-CurlJson -Method GET -Url "$BaseUrl/health" | Out-Null

$registerBody = @{ email = $Email; password = $Password; name = "Ch5 Smoke" } |
  ConvertTo-Json -Compress
Write-Host "1/7 Registering $Email"
Invoke-CurlJson -Method POST -Url "$BaseUrl/api/auth/register" -Body $registerBody |
  Out-Null

$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
Write-Host "2/7 Logging in"
$login = Invoke-CurlJson -Method POST -Url "$BaseUrl/api/auth/login" -Body $loginBody
$token = $login.accessToken
if (-not $token) {
  throw "Login response did not contain accessToken"
}

$temporaryFile = $null
if (-not $FilePath) {
  $temporaryFile = Join-Path ([System.IO.Path]::GetTempPath()) "ch5-smoke-$([guid]::NewGuid()).txt"
  @"
NestJS and LangChain power the Chapter 5 document pipeline.
The smoke-test keyword is pgvector-semantic-search.
"@ | Set-Content -Path $temporaryFile -Encoding utf8
  $FilePath = $temporaryFile
}

try {
  $resolvedFile = (Resolve-Path $FilePath).Path
  Write-Host "3/7 Uploading $resolvedFile"
  $upload = Invoke-CurlJson -Method POST -Url "$BaseUrl/api/documents/upload" `
    -Token $token -ExtraArguments @("-F", "file=@$resolvedFile")
  $documentId = $upload.id
  if (-not $documentId) {
    throw "Upload response did not contain id"
  }

  Write-Host "4/7 Starting document processing"
  Invoke-CurlJson -Method POST -Url "$BaseUrl/api/documents/$documentId/process" `
    -Token $token | Out-Null

  $deadline = (Get-Date).AddSeconds($ProcessingTimeoutSeconds)
  do {
    Start-Sleep -Seconds 2
    $document = Invoke-CurlJson -Method GET `
      -Url "$BaseUrl/api/documents/$documentId" -Token $token
    Write-Host "    document status: $($document.status)"
    if ($document.status -eq "failed") {
      throw "Document processing failed"
    }
  } while ($document.status -ne "completed" -and (Get-Date) -lt $deadline)
  if ($document.status -ne "completed") {
    throw "Document processing timed out after $ProcessingTimeoutSeconds seconds"
  }

  Write-Host "5/7 Searching indexed chunks"
  $searchBody = @{ query = "pgvector semantic search"; topK = 3 } |
    ConvertTo-Json -Compress
  $hits = @(Invoke-CurlJson -Method POST -Url "$BaseUrl/api/search" `
      -Token $token -Body $searchBody)
  if ($hits.Count -eq 0) {
    throw "Search returned no hits"
  }
  Write-Host "    search returned $($hits.Count) hit(s)"

  Write-Host "6/7 Creating conversation"
  $conversationBody = @{ title = "Chapter 5 smoke test" } | ConvertTo-Json -Compress
  $conversation = Invoke-CurlJson -Method POST -Url "$BaseUrl/api/conversations" `
    -Token $token -Body $conversationBody
  if (-not $conversation.id) {
    throw "Conversation response did not contain id"
  }

  Write-Host "7/7 Sending chat request"
  $chatBody = @{
    input = "What keyword appears in the uploaded Chapter 5 smoke-test document?"
  } | ConvertTo-Json -Compress
  try {
    $chat = Invoke-CurlJson -Method POST `
      -Url "$BaseUrl/api/conversations/$($conversation.id)/chat" `
      -Token $token -Body $chatBody
    $chat | ConvertTo-Json -Depth 10
    Write-Host "Smoke test passed."
  } catch {
    Write-Warning "Chat request failed. This is expected when the chat service has no valid OPENAI_API_KEY/OPENAI_BASE_URL configuration."
    Write-Warning $_
    Write-Host "Register, login, upload, process, search, and conversation creation passed."
  }
} finally {
  if ($temporaryFile -and (Test-Path $temporaryFile)) {
    Remove-Item $temporaryFile -Force
  }
}
