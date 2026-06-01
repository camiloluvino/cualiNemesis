# Script de construcción para CualiNemesis

$version = "0.2.1"

$outputFile = Join-Path $PSScriptRoot "cualiNemesisMaster.js"
$srcDir = Join-Path $PSScriptRoot "src"

$files = @(
    "ui/notifications.js",
    "api/roamApi.js",
    "core/extractor.js",
    "ui/modal.js",
    "index.js"
)

# Obtener fecha y hora en formato yyyy-MM-dd HH:mm:ss
$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$header = "// CualiNemesis v$version - Last Updated: $timestamp`r`n`r`n"

$combinedContent = $header

foreach ($file in $files) {
    $filePath = Join-Path $srcDir $file
    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $combinedContent += "// File: $file`r`n" + $content + "`r`n`r`n"
    } else {
        Write-Error "Archivo fuente no encontrado: $filePath"
        exit 1
    }
}

# Escribir el archivo final en UTF8
[System.IO.File]::WriteAllText($outputFile, $combinedContent, [System.Text.Encoding]::UTF8)

Write-Host "Construcción completada para la versión $version. Archivo generado: cualiNemesisMaster.js"
