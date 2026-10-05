param([Parameter(Mandatory=$true)][string]$OutputDir, [switch]$Challenge)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$synth=New-Object System.Speech.Synthesis.SpeechSynthesizer
$format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
$items=@();$i=0
$positive=@('ninja celebration','launch the fireworks','show the dancing cat')
$negative=@('never say ninja celebration','do not launch the fireworks','hide the dancing cat','launch the firework','the cat is dancing today','thanks for joining the stream','that was a really close game','we should take a short break','show the dancing cap','ninja calibration','launch fireworks','I will show the dancing cat later')
if ($Challenge) {
 $positive=@('ninja celebration','launch the fireworks','show the dancing cat','release the rainbow unicorn','ninja start the countdown','switch to the cozy scene')
 $negative=@('thanks for joining the stream','never say ninja celebration','ninja celebration tomorrow','do not launch the fireworks','launch the fireworks later','show the dancing cat tomorrow','release the rainbow uniform','please do not release the rainbow unicorn','ninja stop the countdown','switch to the noisy scene','I said ninja celebration earlier','the phrase is show the dancing cat')
}
try {
 foreach($voice in @('Microsoft David Desktop','Microsoft Zira Desktop')) {
  $synth.SelectVoice($voice)
  foreach($rate in $(if ($Challenge) {@(0)} else {@(-2,0,3)})) {
   $synth.Rate=$rate
   foreach($phrase in $positive) {
    $file="speech-$i.wav";$synth.SetOutputToWaveFile((Join-Path $OutputDir $file),$format);$synth.Speak($phrase);$synth.SetOutputToNull()
    $items+=@{file=$file;phrase=$phrase;expected=$phrase;voice=$voice;rate=$rate};$i++
   }
  }
  $synth.Rate=0
  foreach($phrase in $negative) {
   $file="speech-$i.wav";$synth.SetOutputToWaveFile((Join-Path $OutputDir $file),$format);$synth.Speak($phrase);$synth.SetOutputToNull()
   $items+=@{file=$file;phrase=$phrase;expected='';voice=$voice;rate=0};$i++
  }
 }
 $items | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDir 'utterances.json') -Encoding UTF8
} finally {$synth.Dispose()}
