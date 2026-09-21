param([switch]$Offline, [switch]$RequireExistingSigningKey)
$ErrorActionPreference = 'Stop'
$mobileRoot = $PSScriptRoot
$mobileBundledJdk = Join-Path $mobileRoot 'tools\jdk21\jdk-21.0.12.1+1'
if (!(Test-Path -LiteralPath "$env:JAVA_HOME\bin\java.exe") -and (Test-Path -LiteralPath "$mobileBundledJdk\bin\java.exe")) {
    $env:JAVA_HOME = $mobileBundledJdk
}
if (!$env:ANDROID_HOME -and $env:ANDROID_SDK_ROOT) { $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT }
if (!$env:ANDROID_HOME) {
    $mobileDefaultSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    if (Test-Path -LiteralPath $mobileDefaultSdk) { $env:ANDROID_HOME = $mobileDefaultSdk }
}
$env:ANDROID_USER_HOME = Join-Path $mobileRoot 'tools\android-home'
if (!$env:GRADLE_USER_HOME -and (Test-Path -LiteralPath (Join-Path $mobileRoot 'tools\gradle-home'))) {
    $env:GRADLE_USER_HOME = Join-Path $mobileRoot 'tools\gradle-home'
}
$mobileGradle = Join-Path $mobileRoot 'gradlew.bat'
if (!(Test-Path -LiteralPath $mobileGradle)) { throw 'Gradle wrapper missing from checkout.' }
if ($RequireExistingSigningKey -and !(Test-Path -LiteralPath (Join-Path $env:ANDROID_USER_HOME 'debug.keystore'))) {
    throw 'Original signing key missing; refusing to build an update with a different identity.'
}
$mobileArgs = @('--no-daemon', '--console=plain', ':app:assembleInternalDebug', ':app:assemblePlayDebug', ':app:lintInternalDebug', ':app:lintPlayDebug')
if ($Offline) { $mobileArgs += '--offline' }
Push-Location $mobileRoot
try {
    & $mobileGradle @mobileArgs
    if ($LASTEXITCODE -ne 0) { throw "Android build failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
