# Zoekt kandidaat-foto's op Wikimedia Commons voor de plaatsen in tools\queries.json
# en maakt contactbladen (tools\cand\sheet-N.jpg) om de beste gevelfoto te kiezen.
# De gekozen bestandsnaam komt in data\curated.json als "file": "Naam.jpg" (zie fetch-photos.ps1).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$ua = 'bcn-reisgids/1.0 (persoonlijk reisproject)'
$cand = Join-Path $PSScriptRoot 'cand'
New-Item -ItemType Directory -Force $cand | Out-Null
Add-Type -AssemblyName System.Drawing
function Slug([string]$s) {
  $d = $s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
  return (($d.ToLower() -replace '[^a-z0-9]+', '-').Trim('-'))
}
function Fetch($url, $outFile) {
  for ($try = 0; $try -lt 6; $try++) {
    try {
      if ($outFile) { Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing -UserAgent $ua; return }
      return (Invoke-WebRequest -Uri $url -UseBasicParsing -UserAgent $ua)
    } catch {
      $code = 0; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
      if ($code -eq 429 -or $code -ge 500) { Start-Sleep -Seconds (10 * ($try + 1)); continue }
      throw
    }
  }
  throw 'te veel pogingen'
}
$queries = Get-Content (Join-Path $PSScriptRoot 'queries.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$out = [ordered]@{}
foreach ($p in $queries.PSObject.Properties) {
  $name = $p.Name; $id = Slug $name
  $url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime&iiurlwidth=300&gsrsearch=' + [Uri]::EscapeDataString($p.Value)
  try { $r = Fetch $url $null } catch { Write-Host "FOUT zoeken $name"; continue }
  $json = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
  $pages = @()
  if ($json.query) { $pages = @($json.query.pages.PSObject.Properties | ForEach-Object { $_.Value } | Sort-Object index) }
  $pages = @($pages | Where-Object { $_.imageinfo -and $_.imageinfo[0].mime -eq 'image/jpeg' } | Select-Object -First 6)
  $list = @(); $n = 1
  foreach ($pg in $pages) {
    $thumb = Join-Path $cand "$id-$n.jpg"
    if (-not (Test-Path $thumb)) { try { Fetch $pg.imageinfo[0].thumburl $thumb } catch { continue }; Start-Sleep -Milliseconds 700 }
    $list += [pscustomobject]@{ n = $n; file = ($pg.title -replace '^File:', ''); thumb = $thumb }
    $n++
  }
  $out[$name] = $list
  Write-Host ("{0}: {1} kandidaten" -f $name, $list.Count)
  Start-Sleep -Milliseconds 800
}
[IO.File]::WriteAllText((Join-Path $cand 'candidates.json'), ($out | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding $false))

# contactbladen: 5 plaatsen per blad, 6 kandidaten per rij
$tw = 250; $th = 170; $lab = 22; $perSheet = 5; $names = @($out.Keys); $sheet = 1
for ($s = 0; $s -lt $names.Count; $s += $perSheet) {
  $chunk = $names[$s..([math]::Min($s + $perSheet - 1, $names.Count - 1))]
  $bmp = New-Object Drawing.Bitmap (6 * $tw), ($chunk.Count * ($th + $lab))
  $g = [Drawing.Graphics]::FromImage($bmp); $g.Clear([Drawing.Color]::White)
  $f = New-Object Drawing.Font 'Segoe UI', 10, ([Drawing.FontStyle]::Bold)
  $row = 0
  foreach ($nm in $chunk) {
    $y = $row * ($th + $lab)
    $g.FillRectangle([Drawing.Brushes]::Black, 0, $y, 6 * $tw, $lab)
    $g.DrawString($nm, $f, [Drawing.Brushes]::White, 4, $y + 2)
    foreach ($c in $out[$nm]) {
      $img = [Drawing.Image]::FromFile($c.thumb)
      $x = ($c.n - 1) * $tw
      $g.DrawImage($img, $x + 2, $y + $lab, $tw - 4, $th - 2)
      $g.FillRectangle([Drawing.Brushes]::Red, $x + 2, $y + $lab, 22, 20)
      $g.DrawString([string]$c.n, $f, [Drawing.Brushes]::White, $x + 4, $y + $lab + 1)
      $img.Dispose()
    }
    $row++
  }
  $bmp.Save((Join-Path $cand "sheet-$sheet.jpg"), [Drawing.Imaging.ImageFormat]::Jpeg); $g.Dispose(); $bmp.Dispose(); $sheet++
}
