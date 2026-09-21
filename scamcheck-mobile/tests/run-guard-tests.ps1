$ErrorActionPreference = 'Stop'
$guardProjectRoot = Split-Path -Parent $PSScriptRoot
$guardCacheCandidates = @(
    (Join-Path $guardProjectRoot 'tools/gradle-home/caches/modules-2/files-2.1')
    if ($env:GRADLE_USER_HOME) { Join-Path $env:GRADLE_USER_HOME 'caches/modules-2/files-2.1' }
    (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.gradle/caches/modules-2/files-2.1')
) | Select-Object -Unique
$guardPackages = @(
    'org.jetbrains.kotlin/kotlin-compiler-embeddable/2.0.21',
    'org.jetbrains.kotlin/kotlin-stdlib/2.0.21',
    'org.jetbrains.kotlin/kotlin-script-runtime/2.0.21',
    'org.jetbrains.kotlin/kotlin-reflect/1.6.10',
    'org.jetbrains.intellij.deps/trove4j/1.0.20200330',
    'org.jetbrains/annotations/13.0',
    'org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm/1.6.4'
)
$guardJars = foreach ($guardPackage in $guardPackages) {
    $guardJar = $null
    foreach ($guardCacheRoot in $guardCacheCandidates) {
        $guardPackagePath = Join-Path $guardCacheRoot $guardPackage
        if (Test-Path -LiteralPath $guardPackagePath) {
            $guardJar = Get-ChildItem -LiteralPath $guardPackagePath -Filter '*.jar' -Recurse |
                Where-Object { $_.Name -notmatch '-(?:sources|javadoc)\.jar$' } |
                Sort-Object FullName | Select-Object -First 1
            if ($guardJar) { break }
        }
    }
    if (!$guardJar) {
        throw "Missing cached dependency $guardPackage. Build the Android app with Gradle first, and set GRADLE_USER_HOME if using a custom cache."
    }
    $guardJar
}
$guardPathSeparator = [IO.Path]::PathSeparator
$guardCompilerClasspath = $guardJars.FullName -join $guardPathSeparator
$guardStdlib = ($guardJars | Where-Object Name -eq 'kotlin-stdlib-2.0.21.jar').FullName
$guardJava = Join-Path $guardProjectRoot 'tools/jdk21/jdk-21.0.12.1+1/bin/java.exe'
if (!(Test-Path -LiteralPath $guardJava)) {
    $guardJava = $null
    if ($env:JAVA_HOME) {
        foreach ($guardJavaName in @('bin/java.exe', 'bin/java')) {
            $guardJavaCandidate = Join-Path $env:JAVA_HOME $guardJavaName
            if (Test-Path -LiteralPath $guardJavaCandidate) { $guardJava = $guardJavaCandidate; break }
        }
    }
    if (!$guardJava) {
        $guardJavaCommand = Get-Command java -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($guardJavaCommand) { $guardJava = $guardJavaCommand.Source }
    }
    if (!$guardJava) { throw 'Java not found. Set JAVA_HOME to a JDK or add java to PATH.' }
}
$guardOutput = Join-Path $guardProjectRoot 'build/guard-jvm-tests'
New-Item -ItemType Directory -Force -Path $guardOutput | Out-Null
$guardSources = @(
    'app/src/main/java/app/scamcheck/mobile/RiskEngine.kt',
    'app/src/main/java/app/scamcheck/mobile/SensitiveDataRedactor.kt',
    'app/src/main/java/app/scamcheck/mobile/GuardInbox.kt',
    'tests/GuardInboxCheck.kt',
    'tests/SensitiveDataRedactorCheck.kt',
    'tests/RiskEngineCheck.kt'
) | ForEach-Object { Join-Path $guardProjectRoot $_ }
& $guardJava -cp $guardCompilerClasspath org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -classpath $guardStdlib -d $guardOutput @guardSources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$guardTestClasspath = @($guardOutput, $guardStdlib) -join $guardPathSeparator
& $guardJava '-Dfile.encoding=UTF-8' -cp $guardTestClasspath app.scamcheck.mobile.SensitiveDataRedactorCheckKt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $guardJava '-Dfile.encoding=UTF-8' -cp $guardTestClasspath app.scamcheck.mobile.GuardInboxCheckKt
exit $LASTEXITCODE
