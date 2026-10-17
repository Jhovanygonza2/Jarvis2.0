$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Ejecuta este archivo como administrador para descargar las funciones de voz desde Windows Update.'
}
$log = Join-Path $PSScriptRoot 'language-install.log'
try {
    'Iniciando instalación de voz española.' | Set-Content -LiteralPath $log
    foreach ($capability in @('Language.Basic~~~es-ES~0.0.1.0', 'Language.Speech~~~es-ES~0.0.1.0', 'Language.TextToSpeech~~~es-ES~0.0.1.0')) {
        $state = Get-WindowsCapability -Online -Name $capability
        if ($state.State -ne 'Installed') {
            $result = Add-WindowsCapability -Online -Name $capability
            "$capability : completado. Reinicio necesario: $($result.RestartNeeded)" | Add-Content -LiteralPath $log
        } else { "$capability : ya instalado" | Add-Content -LiteralPath $log }
    }
    'COMPLETADO' | Add-Content -LiteralPath $log
} catch {
    "ERROR: $($_.Exception.Message)" | Add-Content -LiteralPath $log
    throw
}
