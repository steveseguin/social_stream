param(
    [string]$TargetDir = "thirdparty/models/qwen3.5-0.8b-onnx"
)

$ErrorActionPreference = "Stop"

$modelBase = "https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX/resolve/main"
$requiredFiles = @(
    "config.json",
    "generation_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "preprocessor_config.json",
    "onnx/embed_tokens_q4.onnx",
    "onnx/embed_tokens_q4.onnx_data",
    "onnx/decoder_model_merged_q4.onnx",
    "onnx/decoder_model_merged_q4.onnx_data",
    "onnx/vision_encoder_q4.onnx",
    "onnx/vision_encoder_q4.onnx_data"
)

$optionalFiles = @(
    "special_tokens_map.json",
    "chat_template.json"
)

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

foreach ($relativePath in $requiredFiles) {
    $outputPath = Join-Path $TargetDir $relativePath
    $outputDir = Split-Path -Parent $outputPath
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }

    $url = "$modelBase/$relativePath"
    Write-Host "Downloading $relativePath"

    try {
        Invoke-WebRequest -Uri $url -OutFile $outputPath
    }
    catch {
        if (Test-Path $outputPath) {
            Remove-Item -Force $outputPath
        }
        throw
    }
}

foreach ($relativePath in $optionalFiles) {
    $outputPath = Join-Path $TargetDir $relativePath
    $outputDir = Split-Path -Parent $outputPath
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }

    $url = "$modelBase/$relativePath"
    Write-Host "Downloading optional $relativePath"

    try {
        Invoke-WebRequest -Uri $url -OutFile $outputPath
    }
    catch {
        if (Test-Path $outputPath) {
            Remove-Item -Force $outputPath
        }
        Write-Warning "Optional file missing: $relativePath"
    }
}

Write-Host "Local Qwen 3.5 model files downloaded to $TargetDir"
