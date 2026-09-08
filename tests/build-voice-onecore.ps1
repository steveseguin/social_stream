param([Parameter(Mandatory=$true)][string]$OutputDir)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$streamType=[Windows.Media.SpeechSynthesis.SpeechSynthesisStream,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$asTask=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name.StartsWith('IAsyncOperation') } | Select-Object -First 1
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$positive=@('ninja celebration','launch the fireworks','show the dancing cat','release the rainbow unicorn','ninja start the countdown','switch to the cozy scene')
$negative=@('thanks for joining the stream','never say ninja celebration','ninja celebration tomorrow','do not launch the fireworks','launch the fireworks later','show the dancing cat tomorrow','release the rainbow uniform','please do not release the rainbow unicorn','ninja stop the countdown','switch to the noisy scene','I said ninja celebration earlier','the phrase is show the dancing cat')
$negative+=@('then just start the countdown','show the dancing cap','ninja calibration','Nina celebration','then just stop the countdown')
$items=@();$i=0
foreach($voice in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object {$_.DisplayName -in @('Microsoft Linda','Microsoft Richard','Microsoft Mark')}) {
 $synth=New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
 $synth.Voice=$voice
 try {
  foreach($phrase in $positive+$negative) {
   $task=$asTask.MakeGenericMethod($streamType).Invoke($null,@($synth.SynthesizeTextToStreamAsync($phrase)))
   $speech=$task.GetAwaiter().GetResult()
   $inputStream=[System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($speech.GetInputStreamAt(0))
   $file="speech-$i.wav"
   $outputStream=[System.IO.File]::Create((Join-Path $OutputDir $file))
   try {$inputStream.CopyTo($outputStream)} finally {$outputStream.Dispose();$inputStream.Dispose();$speech.Dispose()}
   $items+=@{file=$file;phrase=$phrase;expected=$(if($phrase -in $positive){$phrase}else{''});voice=$voice.DisplayName;rate=0};$i++
  }
 } finally {$synth.Dispose()}
}
if(!$items.Count){throw 'Additional Windows voices are not installed.'}
$items | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDir 'utterances.json') -Encoding UTF8
