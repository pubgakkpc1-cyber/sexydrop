Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation.UniversalApiContract,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()

function Run-Ocr($path) {
    try {
        $abs = (Resolve-Path $path).Path
        $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($abs)
        $file = Await $fileTask ([Windows.Storage.StorageFile])
        $streamTask = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
        $stream = Await $streamTask ([Windows.Storage.Streams.IRandomAccessStream])
        $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
        $decoder = Await $decoderTask ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmapTask = $decoder.GetSoftwareBitmapAsync()
        $bitmap = Await $bitmapTask ([Windows.Graphics.Imaging.SoftwareBitmap])
        $resTask = $engine.RecognizeAsync($bitmap)
        $res = Await $resTask ([Windows.Media.Ocr.OcrResult])
        return $res.Text
    } catch {
        return "ERROR: $_"
    }
}

$files = @(
    "c:\Users\pc\Desktop\Новая папка\case_frames\btn5_zoom.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\btn8_zoom.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\btn11_zoom.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\sec_00.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\sec_05.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\sec_06.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\sec_11.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\sec_12.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\win\preview_13000ms.jpg",
    "c:\Users\pc\Desktop\Новая папка\case_frames\win\modal_top.jpg"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        $txt = Run-Ocr $f
        Write-Host "=== $(Split-Path $f -Leaf) ==="
        Write-Host $txt
    }
}
