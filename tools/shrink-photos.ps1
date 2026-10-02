# Verkleint alle foto's in \photos tot max. 560 px breed (JPEG, kwaliteit 72).
# Veilig om opnieuw te draaien: kleine bestanden blijven staan.
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$codec = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 72L
foreach ($f in Get-ChildItem (Join-Path $root 'photos') -Filter *.jpg) {
  if ($f.Length -lt 110KB) { continue }
  $img = [Drawing.Image]::FromFile($f.FullName)
  $w = [math]::Min(560, $img.Width); $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object Drawing.Bitmap $w, $h
  $g = [Drawing.Graphics]::FromImage($bmp); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose(); $img.Dispose()
  $tmp = $f.FullName + '.tmp'
  $bmp.Save($tmp, $codec, $ep); $bmp.Dispose()
  Move-Item $tmp $f.FullName -Force
}
'{0:N1} MB in {1} foto''s' -f ((Get-ChildItem (Join-Path $root 'photos') | Measure-Object Length -Sum).Sum / 1MB), (Get-ChildItem (Join-Path $root 'photos')).Count
