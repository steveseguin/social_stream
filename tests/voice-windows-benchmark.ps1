param([string]$CorpusDir="$env:TEMP\ssn-voice-corpus",[string]$OutputPath="$env:TEMP\ssn-voice-windows-results.json")
$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Speech
$engine=New-Object System.Speech.Recognition.SpeechRecognitionEngine([System.Globalization.CultureInfo]::GetCultureInfo('en-US'))
$choices=New-Object System.Speech.Recognition.Choices
$choices.Add([string[]]@('ninja celebration','launch the fireworks','show the dancing cat'))
$builder=New-Object System.Speech.Recognition.GrammarBuilder;$builder.Culture=[System.Globalization.CultureInfo]::GetCultureInfo('en-US');$builder.Append($choices)
$grammar=New-Object System.Speech.Recognition.Grammar($builder);$grammar.Name='commands';$engine.LoadGrammar($grammar)
$dictation=New-Object System.Speech.Recognition.DictationGrammar;$dictation.Name='dictation';$engine.LoadGrammar($dictation)
$rows=@()
try {foreach($item in (Get-Content -LiteralPath (Join-Path $CorpusDir 'chunks.json') -Raw|ConvertFrom-Json)){
 $engine.SetInputToWaveFile((Join-Path $CorpusDir $item.file));$clock=[System.Diagnostics.Stopwatch]::StartNew();$results=@();while($true){try{$result=$engine.Recognize()}catch{if($_.Exception.InnerException.Message -like 'No audio input*'){break};throw};if(!$result){break}; $results+=@{text=$result.Text;confidence=$result.Confidence;grammar=$result.Grammar.Name} };$clock.Stop();$rows+=@{expected=$item.expected;condition=$item.condition;phrase=$item.phrase;ms=$clock.ElapsedMilliseconds;results=$results}
};$rows|ConvertTo-Json -Depth 7|Set-Content -LiteralPath $OutputPath -Encoding UTF8;Write-Output $OutputPath}finally{$engine.Dispose()}
