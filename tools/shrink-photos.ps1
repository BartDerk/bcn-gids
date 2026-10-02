# Zet foto's in \photos om naar .jpg (jfif, jpeg, png, webp) en verkleint ze tot max. 560 px breed (kwaliteit 72).
# Veilig om opnieuw te draaien: kleine .jpg-bestanden blijven staan.
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore
$root = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $root 'photos'
$codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 72L

function Open-Image($path) {
  try { return [Drawing.Image]::FromFile($path) } catch {}
  # o.a. webp: via Windows-decoder naar een tijdelijke PNG
  $dec = [Windows.Media.Imaging.BitmapDecoder]::Create([Uri]$path, 'None', 'OnLoad')
  $enc = New-Object Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add($dec.Frames[0])
  $tmp = [IO.Path]::GetTempFileName() + '.png'
  $fs = [IO.File]::Create($tmp); $enc.Save($fs); $fs.Close()
  $bytes = [IO.File]::ReadAllBytes($tmp); Remove-Item $tmp
  return [Drawing.Image]::FromStream((New-Object IO.MemoryStream (, $bytes)))
}

foreach ($f in Get-ChildItem $dir -File | Where-Object { $_.Extension -in '.jpg', '.jfif', '.jpeg', '.png', '.webp', '.JPG', '.JPEG' }) {
  $target = Join-Path $dir ($f.BaseName + '.jpg')
  $isJpg = $f.Extension -ieq '.jpg'
  if ($isJpg -and $f.Length -lt 110KB) { continue }
  try { $img = Open-Image $f.FullName } catch { Write-Host "KAN NIET LEZEN: $($f.Name) ($($_.Exception.Message))" -ForegroundColor Yellow; continue }
  $w = [math]::Min(560, $img.Width); $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object Drawing.Bitmap $w, $h
  $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::White); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose(); $img.Dispose()
  $tmp = $target + '.tmp'
  $bmp.Save($tmp, $codec, $ep); $bmp.Dispose()
  if (-not $isJpg) { Remove-Item $f.FullName }
  Move-Item $tmp $target -Force
  Write-Host ("OK  {0} -> {1} ({2:N0} KB)" -f $f.Name, [IO.Path]::GetFileName($target), ((Get-Item $target).Length / 1KB))
}
'{0:N1} MB in {1} foto''s' -f ((Get-ChildItem $dir | Measure-Object Length -Sum).Sum / 1MB), (Get-ChildItem $dir).Count
