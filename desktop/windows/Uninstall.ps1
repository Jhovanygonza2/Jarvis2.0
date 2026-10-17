$ErrorActionPreference = 'Stop'
$destination = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'JarvisDesktop'))
$executable = Join-Path $destination 'JarvisDesktop.exe'
$running = Get-Process -Name JarvisDesktop -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $executable }
if ($running) { throw 'Primero usa Salir de Jarvis en el icono de la bandeja y vuelve a ejecutar este archivo.' }
$link = Join-Path ([Environment]::GetFolderPath('Startup')) 'Jarvis Desktop.lnk'
if (Test-Path -LiteralPath $link) { Remove-Item -LiteralPath $link }
# Delete only the named installation files; never recursively delete a computed folder.
foreach ($name in @('JarvisDesktop.exe', 'paused', 'status.txt', 'google-voice.json', 'google-voice.json.tmp', 'input-test.json', 'Uninstall.ps1')) {
    $file = Join-Path $destination $name
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file }
}
Write-Output 'Jarvis ya no se iniciará con Windows. Los componentes de idioma se conservan.'
