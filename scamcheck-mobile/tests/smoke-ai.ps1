param([ValidateSet('message_analysis','auto_guard')][string]$Mode='message_analysis')
$ErrorActionPreference='Stop'
$clientSource=Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\app\src\main\java\app\scamcheck\mobile\AiAnalysisClient.kt') -Raw
$promptMatch=[regex]::Match($clientSource,'(?s)private val systemPrompt = """(.*?)"""')
if (!$promptMatch.Success) { throw 'System prompt missing' }
$payload=@{
    model='scamcheck-openai'; temperature=0; max_tokens=900; scamcheck_mode=$Mode; language='vi'
    response_format=@{type='json_object'}
    messages=@(
        @{role='system';content=$promptMatch.Groups[1].Value.Trim()}
        @{role='user';content='Tin nhắn kiểm thử tổng hợp: Tài khoản bị khóa. Gửi mã OTP ngay lập tức vào https://example.invalid/xac-minh'}
    )
} | ConvertTo-Json -Depth 8 -Compress
$response=Invoke-WebRequest -Uri 'https://scamcheck-c3chuyenhvt.vercel.app/api/chat' -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($payload)) -ContentType 'application/json; charset=utf-8' -TimeoutSec 45
$envelope=$response.Content | ConvertFrom-Json
$evaluation=$envelope.choices[0].message.content.Trim() -replace '^```json\s*','' -replace '\s*```$',''
$parsed=$evaluation | ConvertFrom-Json
if ($parsed.risk -notin @('AN_TOAN','NGHI_NGO','NGUY_HIEM','LOW','SAFE','MEDIUM','CAUTION','SUSPICIOUS','CRITICAL','HIGH','DANGEROUS')) { throw 'Unrecognized AI risk' }
if (!$parsed.desc -and !$parsed.contextSummary) { throw 'AI explanation missing' }
if (!$parsed.actions -and !$parsed.safeActions) { throw 'AI safety guidance missing' }
[pscustomobject]@{Mode=$Mode;HTTP=$response.StatusCode;Risk=$parsed.risk;Schema='PASS';SyntheticDataOnly=$true} | Format-List
