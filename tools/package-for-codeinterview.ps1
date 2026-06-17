<#
.SYNOPSIS
    Package each exercise for CodeInterview.io (Windows / PowerShell port of
    package-for-codeinterview.sh).

.DESCRIPTION
    For every app under apps/, this produces TWO artifacts in dist-candidate/<app>/:

      1. <app>.zip          A clean, candidate-only project archive (no _solution/,
                            no node_modules, no dist). Use this for CodeInterview's
                            "import project" flow.

      2. PASTE_MANIFEST.md  Every candidate-facing file, in creation order, with its
                            path as a heading and its full contents in a code block.
                            Use this to recreate the project file-by-file in
                            CodeInterview's React playground (the paste path).

    The _solution/ folder (clean reference + answer key) is NEVER included in either
    artifact. Re-run this any time you add or edit an app.

.EXAMPLE
    pwsh ./tools/package-for-codeinterview.ps1
    # or, on Windows PowerShell 5.1:
    powershell -ExecutionPolicy Bypass -File .\tools\package-for-codeinterview.ps1
#>

# Stop on the first uncaught error (parity with `set -e`).
$ErrorActionPreference = 'Stop'

$Root    = Split-Path -Parent $PSScriptRoot
$AppsDir = Join-Path $Root 'apps'
$OutDir  = Join-Path $Root 'dist-candidate'

# Directory names that must never reach a candidate.
$ExcludeDirs = @('_solution', 'node_modules', 'dist', 'dist-ssr', '.git')
# File names / patterns that must never reach a candidate.
$ExcludeFiles = @('*.local', '*.log', '*.tsbuildinfo')
# Files kept in the zip but omitted from the paste manifest (not useful to paste).
$ManifestSkip = @('package-lock.json', '.gitignore')

# Order in which to list files in the paste manifest (entry chain first, then the
# rest). Anything not matched here is appended alphabetically afterwards.
$PasteOrder = @(
    'package.json',
    'index.html',
    'vite.config.ts',
    'tsconfig.json',
    'src/main.tsx',
    'src/App.tsx',
    'src/styles.css',
    'README.md'
)

# Map a file extension to a markdown code-fence language hint.
function Get-FenceLang([string]$relPath) {
    switch -Wildcard ($relPath) {
        '*.tsx'  { 'tsx' }
        '*.ts'   { 'tsx' }
        '*.css'  { 'css' }
        '*.html' { 'html' }
        '*.json' { 'json' }
        '*.md'   { 'markdown' }
        default  { '' }
    }
}

# True if a file (given its repo-relative-to-app path) should be excluded entirely.
function Test-Excluded([string]$relPath) {
    $parts = $relPath -split '[\\/]'
    foreach ($dir in $ExcludeDirs) {
        if ($parts -contains $dir) { return $true }
    }
    $name = Split-Path $relPath -Leaf
    foreach ($pat in $ExcludeFiles) {
        if ($name -like $pat) { return $true }
    }
    return $false
}

# Reset the output directory.
if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir | Out-Null

$appDirs = Get-ChildItem -Path $AppsDir -Directory | Sort-Object Name

foreach ($appDir in $appDirs) {
    $app    = $appDir.Name
    Write-Host "==> packaging $app"
    $appOut = Join-Path $OutDir $app
    New-Item -ItemType Directory -Path $appOut | Out-Null

    # Gather every candidate file once, as paths relative to the app folder using
    # forward slashes (so manifest headings match the bash version).
    $allFiles = Get-ChildItem -Path $appDir.FullName -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($appDir.FullName.Length + 1) -replace '\\', '/'
        $rel
    } | Where-Object { -not (Test-Excluded $_) } | Sort-Object

    # ---- 1. candidate zip ----------------------------------------------------
    # Stage the candidate files in a temp dir, then compress. Compress-Archive has
    # no exclude option, so staging is the reliable way to omit _solution/ etc.
    $stage = Join-Path ([System.IO.Path]::GetTempPath()) ("ci_{0}_{1}" -f $app, [guid]::NewGuid())
    New-Item -ItemType Directory -Path $stage | Out-Null
    try {
        foreach ($rel in $allFiles) {
            $src = Join-Path $appDir.FullName ($rel -replace '/', '\')
            $dst = Join-Path $stage          ($rel -replace '/', '\')
            $dstDir = Split-Path $dst -Parent
            if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
            Copy-Item -Path $src -Destination $dst
        }
        $zipPath = Join-Path $appOut "$app.zip"
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        # Compress the staged contents (not the staging folder itself).
        Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath
    }
    finally {
        Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    }

    # ---- 2. paste manifest ---------------------------------------------------
    $manifest = Join-Path $appOut 'PASTE_MANIFEST.md'
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("# $app — CodeInterview paste manifest")
    $lines.Add('')
    $lines.Add("Recreate these files (in this order) in CodeInterview's React playground.")
    $lines.Add('The `_solution/` folder is intentionally omitted — never paste it.')
    $lines.Add('')

    $emitted = New-Object System.Collections.Generic.HashSet[string]

    function Add-FileSection {
        param([string]$rel)
        $lang = Get-FenceLang $rel
        $abs  = Join-Path $appDir.FullName ($rel -replace '/', '\')
        $lines.Add("## ``$rel``")
        $lines.Add('')
        $lines.Add('```' + $lang)
        # Read raw so we preserve the file's own newlines exactly.
        $content = Get-Content -Path $abs -Raw
        if ($null -ne $content) {
            # Trim a single trailing newline so the closing fence sits clean.
            $content = $content -replace "`r`n", "`n"
            $content = $content.TrimEnd("`n")
            foreach ($l in ($content -split "`n")) { $lines.Add($l) }
        }
        $lines.Add('```')
        $lines.Add('')
    }

    # Manifest gets candidate files minus the paste-skip list.
    $manifestFiles = $allFiles | Where-Object {
        $name = Split-Path $_ -Leaf
        -not ($ManifestSkip -contains $name)
    }

    # Emit ordered files first.
    foreach ($rel in $PasteOrder) {
        if ($manifestFiles -contains $rel) {
            Add-FileSection $rel
            [void]$emitted.Add($rel)
        }
    }
    # Then anything else not already emitted.
    foreach ($rel in $manifestFiles) {
        if (-not $emitted.Contains($rel)) {
            Add-FileSection $rel
        }
    }

    # Write the manifest as UTF-8 (no BOM) with LF endings to match the .sh output.
    $text = ($lines -join "`n") + "`n"
    [System.IO.File]::WriteAllText($manifest, $text, (New-Object System.Text.UTF8Encoding($false)))

    Write-Host "    -> $zipPath"
    Write-Host "    -> $manifest"
}

Write-Host ''
Write-Host "Done. Candidate-ready artifacts are in: $OutDir"
Write-Host 'Reminder: dist-candidate/ contains ONLY candidate-facing files (no answers).'
