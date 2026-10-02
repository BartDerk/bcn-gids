# Haalt per plaats met een "wiki"-veld in data\curated.json een foto op van Wikimedia Commons.
# Foto's komen in \photos (klein, ~720px) en de bronvermelding in data\photos.json.
# Bestaande foto's worden overgeslagen; verwijder een foto om hem opnieuw op te halen.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object Text.UTF8Encoding $false
$ua = 'bcn-reisgids/1.0 (persoonlijk reisproject)'
New-Item -ItemType Directory -Force (Join-Path $root 'photos') | Out-Null

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
      if ($code -eq 429 -or $code -ge 500) { Start-Sleep -Seconds (15 * ($try + 1)); continue }
      throw
    }
  }
  throw 'te veel pogingen (429)'
}
function GetJson($url) {
  $r = Fetch $url $null
  return ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
}

$curated = Get-Content (Join-Path $root 'data\curated.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$photosPath = Join-Path $root 'data\photos.json'
$photos = [ordered]@{}
if (Test-Path $photosPath) { (Get-Content $photosPath -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $photos[$_.Name] = $_.Value } }

foreach ($p in $curated.PSObject.Properties) {
  $name = $p.Name; $wiki = $p.Value.wiki; $want = $p.Value.file   # "file" = vaste Commons-bestandsnaam (gevelfoto naar keuze)
  if (-not $wiki -and -not $want) { continue }
  $id = Slug $name
  $file = Join-Path $root "photos\$id.jpg"
  $have = $photos.Contains($name) -and (Test-Path $file)
  if ($have -and (-not $want -or $photos[$name].page -like ('*' + [Uri]::EscapeDataString($want)))) { continue }
  if (-not $wiki) { $wiki = 'en:x' }
  $lang, $title = $wiki.Split(':', 2)
  try {
    if ($want) { $fname = $want } else {
    try { $sum = GetJson ("https://$lang.wikipedia.org/api/rest_v1/page/summary/" + [Uri]::EscapeDataString($title.Replace(' ', '_'))) }
    catch {
      # titel niet gevonden: zoek de beste treffer op de naam van de plaats
      $hits = GetJson ("https://$lang.wikipedia.org/w/api.php?action=opensearch&limit=1&format=json&search=" + [Uri]::EscapeDataString($name))
      if (-not $hits[1] -or -not $hits[1][0]) { throw 'geen artikel gevonden' }
      $sum = GetJson ("https://$lang.wikipedia.org/api/rest_v1/page/summary/" + [Uri]::EscapeDataString(([string]$hits[1][0]).Replace(' ', '_')))
    }
    $src = $sum.originalimage.source
    if (-not $src) { $src = $sum.thumbnail.source }
    if (-not $src -or $src -notmatch '/wikipedia/commons/') { Write-Host "GEEN  $name (geen vrije foto)" -ForegroundColor Yellow; continue }
    $m = [regex]::Match($src, '/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/?]+)')
    $fname = [Uri]::UnescapeDataString($m.Groups[1].Value)
    }
    $meta = GetJson ("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&titles=" + [Uri]::EscapeDataString("File:$fname"))
    $ii = ($meta.query.pages.PSObject.Properties | Select-Object -First 1).Value.imageinfo; $info = $null; if ($ii) { $info = $ii[0].extmetadata }
    $artist = ""; if ($info -and $info.Artist) { $artist = ($info.Artist.value -replace '<[^>]+>', '').Trim() }
    if (-not $artist) { $artist = 'onbekend' }
    $lic = "vrije licentie"; if ($info -and $info.LicenseShortName) { $lic = $info.LicenseShortName.value }
    Fetch ("https://commons.wikimedia.org/wiki/Special:FilePath/" + [Uri]::EscapeDataString($fname) + "?width=720") $file
    $photos[$name] = [pscustomobject]@{ file = "photos/$id.jpg"; credit = "$artist, $lic, Wikimedia Commons"; page = "https://commons.wikimedia.org/wiki/File:" + [Uri]::EscapeDataString($fname) }
    Write-Host ("OK    {0} <- {1} ({2})" -f $name, $fname, $lic)
  } catch {
    Write-Host ("FOUT  {0}: {1}" -f $name, $_.Exception.Message) -ForegroundColor Yellow
  }
  Start-Sleep -Milliseconds 2000
}
[IO.File]::WriteAllText($photosPath, ($photos | ConvertTo-Json -Depth 4), $utf8)
