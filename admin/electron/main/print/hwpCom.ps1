# 한글 COM: HWPX → PDF. Windows + 한글 2020 이상.
param(
  [Parameter(Mandatory = $true)][string]$JobPath
)
$ErrorActionPreference = 'Stop'
$job = Get-Content -Raw -Encoding UTF8 $JobPath | ConvertFrom-Json
$hwp = New-Object -ComObject HWPFrame.HwpObject
$hwp.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModule') | Out-Null
$failed = @()
foreach ($item in $job.files) {
  try {
    $opened = $hwp.Open($item.src, 'HWPX', 'forceopen:true')
    if (-not $opened) { throw "open failed" }
    $saved = $hwp.SaveAs($item.pdf, 'PDF', '')
    if (-not $saved) { throw "save failed" }
  } catch {
    $failed += $item.src
  }
}
$hwp.Quit()
if ($failed.Count -gt 0) {
  Write-Error ("PDF 변환 실패: " + ($failed -join ', '))
  exit 1
}
