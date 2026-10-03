$ErrorActionPreference = 'Continue'
$codex = 'C:\\Users\\39795\\AppData\\Local\\OpenAI\\Codex\\bin\\8aaf1547b825b104\\codex.exe'
$workdir = 'D:\\AI_Projects\\chromatic-wt-s03-door'
$promptPath = 'D:\\AI_Projects\\chromatic-tile-transport\\runs\\six-studies-s03-door\\PROMPT-s03-r3.txt'
$last = 'D:\\AI_Projects\\chromatic-tile-transport\\runs\\six-studies-s03-door\\last-message-s03-r3.txt'
$outPath = 'D:\\AI_Projects\\chromatic-tile-transport\\runs\\six-studies-s03-door\\events-s03-r3.jsonl'
$errPath = 'D:\\AI_Projects\\chromatic-tile-transport\\runs\\six-studies-s03-door\\stderr-s03-r3.txt'
$watch = 'D:\\AI_Projects\\chromatic-tile-transport\\runs\\six-studies-s03-door\\watch-s03-r3.log'
$prompt = [System.IO.File]::ReadAllText($promptPath, [System.Text.UTF8Encoding]::new($false))
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $codex
$psi.WorkingDirectory = $workdir
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
$psi.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
foreach ($a in @('exec','--json','-m','gpt-6-astra','-c','model_reasoning_effort=xhigh','-C',$workdir,'-o',$last,'--skip-git-repo-check',$prompt)) { [void]$psi.ArgumentList.Add($a) }
$p = New-Object System.Diagnostics.Process
$p.StartInfo = $psi
[void]$p.Start()
$p.StandardInput.Close()
Set-Content -Encoding utf8 $watch @("label=s03-r3","started=$((Get-Date).ToString('o'))","pid=$($p.Id)","workdir=D:\AI_Projects\chromatic-wt-s03-door","model=gpt-6-astra","effort=xhigh","note=detached-relaunch")
$outWriter = New-Object System.IO.StreamWriter($outPath, $false, ([System.Text.UTF8Encoding]::new($false)))
$errWriter = New-Object System.IO.StreamWriter($errPath, $false, ([System.Text.UTF8Encoding]::new($false)))
$stdout = $p.StandardOutput
$stderr = $p.StandardError
$outTask = [System.Threading.Tasks.Task]::Run([action]{ while (($line = $stdout.ReadLine()) -ne $null) { $outWriter.WriteLine($line); $outWriter.Flush() } })
$errTask = [System.Threading.Tasks.Task]::Run([action]{ while (($line = $stderr.ReadLine()) -ne $null) { $errWriter.WriteLine($line); $errWriter.Flush() } })
$p.WaitForExit()
Add-Content -Encoding utf8 $watch "exit=$($p.ExitCode)"
Add-Content -Encoding utf8 $watch "finished=$((Get-Date).ToString('o'))"
try { $outTask.Wait(5000) | Out-Null; $errTask.Wait(5000) | Out-Null; $outWriter.Close(); $errWriter.Close() } catch {}