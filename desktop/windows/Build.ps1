$ErrorActionPreference = 'Stop'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compiler = Join-Path $framework 'csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Se necesita .NET Framework de Windows de 64 bits.' }
$destination = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$executable = Join-Path $destination 'JarvisDesktop.exe'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$executable" /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.Security.dll "/reference:$framework\WPF\System.Speech.dll" (Join-Path $PSScriptRoot 'Dialog.cs') (Join-Path $PSScriptRoot 'Program.cs') (Join-Path $PSScriptRoot 'GoogleVoice.cs') (Join-Path $PSScriptRoot 'GoogleVoiceForm.cs') (Join-Path $PSScriptRoot 'GoogleVoiceTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación.' }
$test = Start-Process -FilePath $executable -ArgumentList '--self-test' -WindowStyle Hidden -Wait -PassThru
if ($test.ExitCode -ne 0) { throw 'Fallaron las pruebas de activación.' }
Write-Output "Compilación y pruebas correctas: $executable"
