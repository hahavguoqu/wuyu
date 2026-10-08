param(
    [ValidateSet('editor','play','verify','web','bake')]
    [string]$Mode = 'editor',
    [string]$GodotPath = ''
)
$ErrorActionPreference = 'Stop'
$migrationRoot = Split-Path $PSScriptRoot -Parent
$migrationProject = Join-Path $migrationRoot 'godot'
if (-not $GodotPath) {
    $GodotPath = Join-Path $migrationRoot 'artifacts/godot-tools/Godot_v4.7.2-stable_win64_console.exe'
    if (-not (Test-Path -LiteralPath $GodotPath)) {
        $migrationCommand = Get-Command godot -ErrorAction SilentlyContinue
        if ($migrationCommand) { $GodotPath = $migrationCommand.Source }
    }
}
if (-not (Test-Path -LiteralPath $GodotPath)) {
    throw 'Godot 4.7.2 not found. Pass -GodotPath with the path to an official Godot executable.'
}
switch ($Mode) {
    'editor' { & $GodotPath --path $migrationProject --editor }
    'play' { & $GodotPath --path $migrationProject }
    'verify' { & $GodotPath --headless --path $migrationProject -- --verify }
    'web' {
        $migrationWeb = Join-Path $migrationProject 'build/web'
        New-Item -ItemType Directory -Force $migrationWeb | Out-Null
        Set-Content -LiteralPath (Join-Path (Split-Path $migrationWeb -Parent) '.gdignore') -Value ''
        & $GodotPath --headless --path $migrationProject --export-release Web 'build/web/index.html'
    }
    'bake' {
        Push-Location $migrationRoot
        try {
            & node tools/export-godot.mjs
            if ($LASTEXITCODE -ne 0) { throw 'Source data export failed.' }
            & $GodotPath --headless --path $migrationProject -- --bake
        } finally { Pop-Location }
    }
}
if ($LASTEXITCODE -ne 0) { throw "Godot command failed with exit code $LASTEXITCODE." }
