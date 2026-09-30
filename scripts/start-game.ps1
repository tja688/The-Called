# 同时拉起 P_CD 的 DevHost 和本仓库的 Vite。浏览器只访问 Vite，/api 由 Vite 转到 DevHost。
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repo = Split-Path -Parent $PSScriptRoot
$pcdRoot = if ($env:PCD_ROOT) { $env:PCD_ROOT } else { Join-Path (Split-Path -Parent $repo) 'P_CD' }
$pcdRoot = [System.IO.Path]::GetFullPath($pcdRoot)
$project = Join-Path $pcdRoot 'src\Pcd.DevHost\Pcd.DevHost.csproj'

if (-not (Test-Path -LiteralPath $project)) {
    Write-Host "[错误] 找不到 P_CD 内核：$pcdRoot"
    Write-Host "默认找本仓库上一级的 P_CD。要换位置，先设置环境变量 PCD_ROOT。"
    exit 1
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 没有找到 dotnet，无法启动对局服务。"
    exit 1
}

function Test-PortFree([int] $Port) {
    $needle = ":$Port "
    foreach ($line in (netstat -ano -p tcp | Select-String -Pattern 'LISTENING')) {
        if ($line.Line.Contains($needle)) { return $false }
    }
    return $true
}

function Find-Port([int] $Start, [int] $Tries) {
    for ($offset = 0; $offset -lt $Tries; $offset++) {
        $port = $Start + $offset
        if (Test-PortFree $port) { return $port }
    }
    throw "从 $Start 起 $Tries 个端口都已被占用。"
}

function Find-CatalogPort([int] $Start, [int] $Tries) {
    for ($offset = 0; $offset -lt $Tries; $offset++) {
        $port = $Start + $offset
        if (Test-PortFree $port) { continue }
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/catalog" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return $port }
        } catch {
            continue
        }
    }
    return $null
}

function Start-DevHost([int] $Port, [switch] $NoBuild) {
    $arguments = @('run', '--project', $project, '--urls', "http://127.0.0.1:$Port")
    if ($NoBuild) { $arguments += '--no-build' }
    return Start-Process -FilePath 'dotnet' -ArgumentList $arguments -WorkingDirectory $pcdRoot -PassThru -NoNewWindow
}

function Wait-DevHost([System.Diagnostics.Process] $Process, [int] $Port) {
    $deadline = (Get-Date).AddSeconds(120)
    while ((Get-Date) -lt $deadline) {
        if ($Process.HasExited) { return $false }
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/catalog" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return $true }
        } catch {
            Start-Sleep -Milliseconds 400
        }
    }
    return $false
}

$owned = $false
$proc = $null
$hostPort = Find-CatalogPort 5180 50
if ($hostPort) {
    Write-Host "[内核] 沿用已在运行的对局服务 http://127.0.0.1:$hostPort/"
} else {
    $hostPort = Find-Port 5180 50
    $owned = $true
    Write-Host "[内核] 启动 http://127.0.0.1:$hostPort/"
    $proc = Start-DevHost $hostPort
}

$webPort = Find-Port 4174 50
$env:PCD_API = "http://127.0.0.1:$hostPort"
Set-Location -LiteralPath $repo
Write-Host "[内核] $pcdRoot"
Write-Host "[网页] http://localhost:$webPort/"

try {
    if ($owned) {
        if (-not (Wait-DevHost $proc $hostPort)) {
            if ($proc -and -not $proc.HasExited) {
                & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
            }
            Write-Host "[内核] 改为直接运行已经编译好的程序。"
            $proc = Start-DevHost $hostPort -NoBuild
            if (-not (Wait-DevHost $proc $hostPort)) {
                throw "对局服务在 120 秒内没有起来。"
            }
        }
    }

    Write-Host "[启动] 正在打开浏览器..."
    & (Join-Path $repo 'node_modules\.bin\vite.cmd') --config vite.config.ts --host 0.0.0.0 --port $webPort --strictPort --open
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    if ($owned -and $proc -and -not $proc.HasExited) {
        & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
    }
}
