param(
  [Parameter(Mandatory=$true)][string]$Worktree,
  [Parameter(Mandatory=$true)][string]$RunDir,
  [Parameter(Mandatory=$true)][string]$Mode
)
$ErrorActionPreference = 'Stop'
$codex = 'C:\Users\39795\AppData\Local\OpenAI\Codex\bin\8aaf1547b825b104\codex.exe'
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
$promptPath = Join-Path $RunDir 'PROMPT.txt'
$outLast = Join-Path $RunDir 'last-message.txt'
$outJsonl = Join-Path $RunDir 'events.jsonl'
$outErr = Join-Path $RunDir 'stderr.txt'
$meta = Join-Path $RunDir 'meta.json'
$utf8 = New-Object System.Text.UTF8Encoding $false
$promptBytes = [System.IO.File]::ReadAllBytes($promptPath)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $codex
$psi.WorkingDirectory = $Worktree
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
$psi.Arguments = 'exec --json -m gpt-6-astra -c model_reasoning_effort="xhigh" --dangerously-bypass-approvals-and-sandbox -C "' + $Worktree + '" -o "' + $outLast + '" -'
$p = [System.Diagnostics.Process]::Start($psi)
$p.StandardInput.BaseStream.Write($promptBytes, 0, $promptBytes.Length)
$p.StandardInput.BaseStream.Flush()
$p.StandardInput.Close()
$stdoutTask = $p.StandardOutput.ReadToEndAsync()
$stderrTask = $p.StandardError.ReadToEndAsync()
$p.WaitForExit()
[System.IO.File]::WriteAllText($outJsonl, $stdoutTask.Result, $utf8)
[System.IO.File]::WriteAllText($outErr, $stderrTask.Result, $utf8)
$metaObj = [ordered]@{exitCode=$p.ExitCode; pid=$p.Id; ended=(Get-Date).ToString('o'); model='gpt-6-astra'; effort='xhigh'; mode=$Mode; worktree=$Worktree}
($metaObj | ConvertTo-Json) | Set-Content -Encoding utf8 $meta
Write-Output ("EXIT=" + $p.ExitCode)
Write-Output ("LAST_EXISTS=" + (Test-Path $outLast))
if (Test-Path $outLast) { Write-Output '---LAST---'; Get-Content $outLast -Raw -Encoding UTF8 }
exit $p.ExitCode
