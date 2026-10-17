param([switch]$NoStart)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Build.ps1')
$destination = Join-Path $env:LOCALAPPDATA 'JarvisDesktop'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$executable = Join-Path $destination 'JarvisDesktop.exe'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'dist\JarvisDesktop.exe') -Destination $executable -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Uninstall.ps1') -Destination (Join-Path $destination 'Uninstall.ps1') -Force
$startup = [Environment]::GetFolderPath('Startup')
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path $startup 'Jarvis Desktop.lnk'))
$link.TargetPath = $executable
$link.WorkingDirectory = $destination
$link.Description = 'Jarvis: escucha local al decir Jarvis. No saluda al iniciar.'
$link.Save()
if (-not $NoStart) { Start-Process -FilePath $executable -WindowStyle Hidden }
Write-Output "Instalado para este usuario: $executable"
