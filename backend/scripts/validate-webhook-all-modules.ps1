param(
  [Parameter(Mandatory = $true)]
  [string]$WebhookUrl,

  [Parameter(Mandatory = $true)]
  [string]$BackendBaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$AdminSyncToken,

  [int]$TimeoutSec = 20,

  [string[]]$Tables
)

$ErrorActionPreference = 'Stop'

$defaultTables = @(
  'CUENTAS',
  'JUGADORES',
  'JUGADORES_VISITA',
  'COMUNICACIONES',
  'CONVOCATORIAS',
  'EVENTOS',
  'ASISTENCIA',
  'PAGOS',
  'PAGOS_MENSUALIDADES',
  'ALERTAS',
  'ESTADISTICAS',
  'EVALUACIONES',
  'GAMIFICACION_PUNTOS',
  'QUIZ_PREGUNTAS',
  'PIZARRA_TACTICA',
  'RESULTADOS',
  'PARTIDOS_LIVE',
  'STAFF',
  'TORNEOS',
  'CAJA_EVENTO_KIOSCO',
  'CATALOGO_INVENTARIO',
  'EGRESOS',
  'CLUBES',
  'ASISTENCIA_EVENTOS',
  'ENCUESTAS',
  'ENCUESTAS_RESPUESTAS',
  'LESIONES',
  'DISCIPLINA',
  'ENTRENAMIENTOS'
)

$tables = if ($Tables -and $Tables.Count -gt 0) { $Tables } else { $defaultTables }

$results = New-Object System.Collections.Generic.List[object]

foreach ($table in $tables) {
  Write-Output ("checking_table={0}" -f $table)
  $ts = (Get-Date).ToString('o')
  $marker = "MOD_${table}_$((Get-Date).ToString('yyyyMMddHHmmss'))"

  $payloadObj = @{
    source = 'all-modules-validation'
    events = @(
      @{
        table = $table
        action = 'POST'
        path = '/validation/all-modules'
        statusCode = 200
        occurredAt = $ts
        body = @{
          marker = $marker
          module = $table
          created_at = $ts
        }
        params = @{}
        actor = @{
          id = 'copilot'
          rol = 'diagnostic'
        }
      }
    )
  }

  $payload = $payloadObj | ConvertTo-Json -Depth 8

  try {
    $resp = Invoke-WebRequest -Uri $WebhookUrl -Method Post -ContentType 'application/json' -Body $payload -TimeoutSec $TimeoutSec -UseBasicParsing
    $json = $null
    try {
      $json = $resp.Content | ConvertFrom-Json
    } catch {
      $json = $null
    }

    $item = [pscustomobject]@{
      table = $table
      ok = if ($json) { [bool]$json.ok } else { $false }
      processed = if ($json -and $json.PSObject.Properties.Name -contains 'processed') { $json.processed } else { '' }
      script_version = if ($json -and $json.PSObject.Properties.Name -contains 'script_version') { $json.script_version } else { '' }
      error = if ($json -and $json.PSObject.Properties.Name -contains 'error' -and $json.error) { $json.error } elseif (-not $json) { 'invalid_json_response' } else { '' }
      marker = $marker
    }
    $results.Add($item)
    Write-Output ("result table={0} ok={1} processed={2} script_version={3} error={4}" -f $item.table, $item.ok, $item.processed, $item.script_version, $item.error)
  } catch {
    $status = ''
    $body = ''
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode.value__
      try {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $sr.ReadToEnd()
      } catch {
        $body = ''
      }
    }

    $item = [pscustomobject]@{
      table = $table
      ok = $false
      processed = ''
      script_version = ''
      error = if ($status) { "HTTP ${status} ${body}" } else { $_.Exception.Message }
      marker = $marker
    }
    $results.Add($item)
    Write-Output ("result table={0} ok={1} processed={2} script_version={3} error={4}" -f $item.table, $item.ok, $item.processed, $item.script_version, $item.error)
  }
}

$okCount = ($results | Where-Object { $_.ok -eq $true }).Count
$failCount = ($results | Where-Object { $_.ok -ne $true }).Count

Write-Output ("modules_total={0} ok={1} fail={2}" -f $tables.Count, $okCount, $failCount)

$headers = @{ 'x-sync-token' = $AdminSyncToken }

try {
  $ping = Invoke-RestMethod -Uri "$BackendBaseUrl/api/admin/sync-sheets/webhook-ping" -Method Post -Headers $headers -TimeoutSec $TimeoutSec
  Write-Output ("ping_ok={0} message={1}" -f $ping.ok, $ping.message)
} catch {
  Write-Output ("ping_error={0}" -f $_.Exception.Message)
}

try {
  $flush = Invoke-RestMethod -Uri "$BackendBaseUrl/api/admin/sync-sheets/webhook-flush" -Method Post -Headers $headers -TimeoutSec $TimeoutSec
  Write-Output ("flush_ok={0} message={1}" -f $flush.ok, $flush.message)
} catch {
  Write-Output ("flush_error={0}" -f $_.Exception.Message)
}
