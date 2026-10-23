param([string]$SourceFile, [string]$OutputFile)
$ErrorActionPreference = 'Stop'
Write-Output 'Compiling CLI stub'
Add-Type -Path $SourceFile -OutputAssembly $OutputFile -OutputType ConsoleApplication
Write-Output 'CLI stub ready'
