$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$PinnedFfmpegVersion = "8.1.2"
$PinnedPackageSha512 = "637fd984d75a98e3c05926d00bde79afefdda30a4b95d052b362655762f4d99d336eba0ad7ded638e248bb1363f5cdaa4eb3040b1fb53c2bfec4553eabc9c593"
$PackageUrl = "https://community.chocolatey.org/api/v2/package/ffmpeg/$PinnedFfmpegVersion"

function Assert-NativeSuccess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,

    [Parameter(Mandatory = $true)]
    [int]$ExitCode
  )

  if ($ExitCode -ne 0) {
    throw "$Label failed with exit code $ExitCode."
  }
}

function Assert-PinnedToolVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ToolName,

    [Parameter(Mandatory = $true)]
    [string]$ExecutablePath
  )

  if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
    throw "$ToolName was not installed at the expected Chocolatey shim path '$ExecutablePath'."
  }

  $versionLines = @(& $ExecutablePath -version 2>&1)
  $versionExitCode = $LASTEXITCODE
  Assert-NativeSuccess -Label "$ToolName version probe" -ExitCode $versionExitCode
  $firstLine = [string]$versionLines[0]
  $expectedPrefix = "$ToolName version $PinnedFfmpegVersion"
  if (-not $firstLine.StartsWith($expectedPrefix, [StringComparison]::Ordinal)) {
    throw "$ToolName version mismatch. Expected prefix '$expectedPrefix', received '$firstLine'."
  }

  Write-Host "$ToolName verified: $firstLine"
}

function Export-StepEnvironment {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  Set-Item -LiteralPath "Env:$Name" -Value $Value
  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_ENV)) {
    "$Name=$Value" | Out-File -LiteralPath $env:GITHUB_ENV -Encoding utf8 -Append
  }
}

$chocoCommand = Get-Command choco.exe -ErrorAction Stop
$temporaryRoot = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
  [IO.Path]::GetTempPath()
} else {
  $env:RUNNER_TEMP
}
$packageDirectory = Join-Path $temporaryRoot "speakright-release-media-$PinnedFfmpegVersion"
$packagePath = Join-Path $packageDirectory "ffmpeg.$PinnedFfmpegVersion.nupkg"
New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null

Invoke-WebRequest `
  -Uri $PackageUrl `
  -OutFile $packagePath `
  -MaximumRedirection 5 `
  -MaximumRetryCount 3 `
  -RetryIntervalSec 2

$packageHash = (Get-FileHash -Algorithm SHA512 -LiteralPath $packagePath).Hash.ToLowerInvariant()
if ($packageHash -cne $PinnedPackageSha512) {
  throw "FFmpeg Chocolatey package SHA-512 mismatch. Expected '$PinnedPackageSha512', received '$packageHash'."
}
Write-Host "FFmpeg Chocolatey package verified: SHA-512 $packageHash"

& $chocoCommand.Source install ffmpeg `
  "--version=$PinnedFfmpegVersion" `
  "--source=$packageDirectory" `
  --yes `
  --no-progress `
  --limit-output `
  --require-checksums `
  --allow-downgrade
$installExitCode = $LASTEXITCODE
Assert-NativeSuccess -Label "Pinned FFmpeg Chocolatey installation" -ExitCode $installExitCode

$chocolateyBin = Split-Path -Parent $chocoCommand.Source
$chocolateyRoot = Split-Path -Parent $chocolateyBin
$installedNuspecPath = Join-Path $chocolateyRoot "lib/ffmpeg/ffmpeg.nuspec"
if (-not (Test-Path -LiteralPath $installedNuspecPath -PathType Leaf)) {
  throw "The installed FFmpeg package manifest was not found at '$installedNuspecPath'."
}
$installedNuspec = [xml](Get-Content -LiteralPath $installedNuspecPath -Raw)
$installedVersionNode = $installedNuspec.SelectSingleNode(
  "/*[local-name()='package']/*[local-name()='metadata']/*[local-name()='version']"
)
if ($null -eq $installedVersionNode) {
  throw "The installed FFmpeg package manifest does not contain a version node."
}
$installedPackageVersion = [string]$installedVersionNode.InnerText
if ($installedPackageVersion -cne $PinnedFfmpegVersion) {
  throw "Installed FFmpeg package version mismatch. Expected '$PinnedFfmpegVersion', received '$installedPackageVersion'."
}
Write-Host "FFmpeg Chocolatey package version verified: $installedPackageVersion"

$ffmpegPath = Join-Path $chocolateyBin "ffmpeg.exe"
$ffprobePath = Join-Path $chocolateyBin "ffprobe.exe"

Assert-PinnedToolVersion -ToolName "ffmpeg" -ExecutablePath $ffmpegPath
Assert-PinnedToolVersion -ToolName "ffprobe" -ExecutablePath $ffprobePath

Export-StepEnvironment -Name "FFMPEG_PATH" -Value $ffmpegPath
Export-StepEnvironment -Name "FFPROBE_PATH" -Value $ffprobePath
