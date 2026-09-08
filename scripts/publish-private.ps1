# Run from an extracted project: pwsh -File .\scripts\publish-private.ps1
[CmdletBinding()]
param(
  [string]$Owner = 'DDDFXYqiming',
  [string]$Name = 'chromatic-tile-transport',
  [switch]$DryRun,
  [switch]$ResumeExisting
)
$ErrorActionPreference = 'Stop'
$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) { throw 'Python 3.10+ is required. Install Python and reopen PowerShell.' }
$Arguments = @('-X', 'utf8', (Join-Path $PSScriptRoot 'publish_private.py'), '--owner', $Owner, '--name', $Name)
if ($DryRun) { $Arguments += '--dry-run' } else { $Arguments += '--login' }
if ($ResumeExisting) { $Arguments += '--resume-existing' }
& $Python.Source @Arguments
if ($LASTEXITCODE -ne 0) { throw "Publishing stopped (exit $LASTEXITCODE). No success is assumed." }
