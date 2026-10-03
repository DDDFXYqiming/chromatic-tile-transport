$ErrorActionPreference = 'Stop'
$codex = 'C:\Users\39795\AppData\Local\OpenAI\Codex\bin\8aaf1547b825b104\codex.exe'
$repo = 'D:\AI_Projects\chromatic-tile-transport'
$run = Join-Path $repo 'runs\six-studies-style-pass'
$promptPath = Join-Path $run 'PROMPT.txt'
$outLast = Join-Path $run 'last-message.txt'
$outJsonl = Join-Path $run 'events.jsonl'
$outErr = Join-Path $run 'stderr.txt'
$meta = Join-Path $run 'meta.json'
$utf8 = New-Object System.Text.UTF8Encoding $false
$promptBytes = [System.IO.File]::ReadAllBytes($promptPath)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $codex
$psi.WorkingDirectory = $repo
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
$psi.Arguments = 'exec --json -m gpt-6-astra -c model_reasoning_effort="xhigh" --dangerously-bypass-approvals-and-sandbox -C "' + $repo + '" -o "' + $outLast + '" -'

$p = [System.Diagnostics.Process]::Start($psi)
$p.StandardInput.BaseStream.Write($promptBytes, 0, $promptBytes.Length)
$p.StandardInput.BaseStream.Flush()
$p.StandardInput.Close()
$stdoutTask = $p.StandardOutput.ReadToEndAsync()
$stderrTask = $p.StandardError.ReadToEndAsync()
$p.WaitForExit()
$stdout = $stdoutTask.Result
$stderr = $stderrTask.Result
[System.IO.File]::WriteAllText($outJsonl, $stdout, $utf8)
[System.IO.File]::WriteAllText($outErr, $stderr, $utf8)
$metaObj = [ordered]@{exitCode=$p.ExitCode; pid=$p.Id; ended=(Get-Date).ToString('o'); model='gpt-6-astra'; effort='xhigh'; mode='style-pass'}
($metaObj | ConvertTo-Json) | Set-Content -Encoding utf8 $meta
Write-Output ("EXIT=" + $p.ExitCode)
Write-Output ("LAST_EXISTS=" + (Test-Path $outLast))
if (Test-Path $outLast) { Write-Output '---LAST---'; Get-Content $outLast -Raw -Encoding UTF8 }
if ($p.ExitCode -ne 0 -and $stderr) { Write-Output '---STDERR---'; Write-Output $stderr }
exit $p.ExitCode
