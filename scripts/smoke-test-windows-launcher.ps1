$ErrorActionPreference = 'Stop'

$exe = Get-ChildItem -Path (Join-Path $PSScriptRoot '..\artifacts') -Filter '*.exe' | Select-Object -First 1
if ($null -eq $exe) {
  throw 'No Windows launcher was produced.'
}

$env:WIREBENCH_NO_BROWSER = '1'
$stdout = Join-Path $env:TEMP 'wirebench-launcher.stdout.log'
$stderr = Join-Path $env:TEMP 'wirebench-launcher.stderr.log'
$process = Start-Process -FilePath $exe.FullName -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$expectedHealth = "wirebench-launcher:$($exe.BaseName -replace '^WireBench-(.+)-win-x64$', '$1')"

try {
  $healthUri = 'http://127.0.0.1:48173/__wirebench_health'
  $rootUri = 'http://127.0.0.1:48173/'
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 200
    try {
      $health = Invoke-WebRequest -UseBasicParsing -Uri $healthUri
      if ($health.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      # The launcher may still be binding the local port.
    }
  }

  if (-not $ready) {
    throw "Launcher did not become ready. $([System.IO.File]::ReadAllText($stderr))"
  }
  if ($process.HasExited) {
    throw 'The launcher exited instead of serving the app; another process may already own the port.'
  }
  if ($health.Content.Trim() -ne $expectedHealth) {
    throw "Unexpected health response: $($health.Content)"
  }

  $page = Invoke-WebRequest -UseBasicParsing -Uri $rootUri
  if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'WireBench') {
    throw 'Launcher did not serve the embedded application.'
  }

  $assetPaths = [regex]::Matches($page.Content, '(?:src|href)="([^"]+\.(?:js|css))"') |
    ForEach-Object { $_.Groups[1].Value } |
    Select-Object -Unique
  if ($assetPaths.Count -lt 2) {
    throw 'Launcher page did not reference both JavaScript and CSS assets.'
  }
  foreach ($assetPath in $assetPaths) {
    $asset = Invoke-WebRequest -UseBasicParsing -Uri ([System.Uri]::new($rootUri, $assetPath))
    if ($asset.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace($asset.Content)) {
      throw "Launcher did not serve asset: $assetPath"
    }
  }
} finally {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
    $process.WaitForExit()
  }
  Remove-Item Env:WIREBENCH_NO_BROWSER -ErrorAction SilentlyContinue
}
