# Bouwt data\places.json uit de Google Maps-exports in \ToVisit.
#   ToVisit\BCN.csv       -> lijst "bcn"  (bezienswaardigheden, ook voor gast)
#   ToVisit\BCN Bar.csv   -> lijst "bar"
#   ToVisit\BCN shop.csv  -> lijst "shop"
# Per plaats komen er gegevens uit:
#   data\coords.json   coordinaten + adres + wijk (uit Google Maps)
#   data\curated.json  categorie, uitleg en Wikipedia-titel voor de foto
#   data\photos.json   foto + bronvermelding (gemaakt door tools\fetch-photos.ps1)
# Daarna: sw.js VERSION verhogen en pushen.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object Text.UTF8Encoding $false
function Slug([string]$s) {
  $d = $s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
  return (($d.ToLower() -replace '[^a-z0-9]+', '-').Trim('-'))
}
function LoadMap($path) {
  $h = @{}
  if (Test-Path $path) { (Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $h[$_.Name] = $_.Value } }
  return $h
}
$coords = LoadMap (Join-Path $root 'data\coords.json')
$curated = LoadMap (Join-Path $root 'data\curated.json')
$photos = LoadMap (Join-Path $root 'data\photos.json')
$lists = [ordered]@{ 'BCN.csv' = 'bcn'; 'BCN Bar.csv' = 'bar'; 'BCN shop.csv' = 'shop' }
$places = @(); $noCoords = @(); $noCurated = @(); $ids = @{}
foreach ($file in $lists.Keys) {
  $list = $lists[$file]
  $path = Join-Path $root "ToVisit\$file"
  if (-not (Test-Path $path)) { Write-Host "Ontbreekt: $path" -ForegroundColor Yellow; continue }
  foreach ($row in (Import-Csv $path -Encoding UTF8)) {
    $name = $row.'Titel'
    if (-not $name) { continue }
    if (-not $coords.ContainsKey($name)) { $noCoords += $name; continue }
    $c = $coords[$name]
    $cur = $curated[$name]
    $cat = $list; $desc = $null; $isNew = $false
    if ($list -eq 'bcn') { $cat = 'overig' }
    if ($cur) { if ($cur.cat) { $cat = $cur.cat }; $desc = $cur.desc; if ($cur.new) { $isNew = $true } } elseif ($list -eq 'bcn') { $noCurated += $name }
    $id = Slug $name; $n = 2; $base = $id
    while ($ids.ContainsKey($id)) { $id = "$base-$n"; $n++ }
    $ids[$id] = $true
    $ph = $photos[$name]
    $photo = $null; $credit = $null
    if ($ph) { $photo = $ph.file; $credit = $ph.credit }
    elseif (Test-Path (Join-Path $root "photos\$id.jpg")) { $photo = "photos/$id.jpg" }   # zelf toegevoegde foto (bestandsnaam = id)
    $places += [pscustomobject][ordered]@{
      id = $id; name = $name; list = $list; cat = $cat
      lat = $c.lat; lng = $c.lng; address = $c.address; district = $c.district
      desc = $desc; maps = $row.'URL'
      photo = $photo; credit = $credit; new = $isNew
    }
  }
}
[IO.File]::WriteAllText((Join-Path $root 'data\places.json'), ($places | ConvertTo-Json -Depth 4), $utf8)
Write-Host ("{0} plaatsen geschreven ({1} bcn, {2} bar, {3} shop; {4} met foto)" -f $places.Count, @($places | ? list -eq 'bcn').Count, @($places | ? list -eq 'bar').Count, @($places | ? list -eq 'shop').Count, @($places | ? photo).Count)
if ($noCoords.Count) { Write-Host "ZONDER COORDINATEN (nog toevoegen aan data\coords.json):" -ForegroundColor Yellow; $noCoords | ForEach-Object { Write-Host "  $_" } }
if ($noCurated.Count) { Write-Host "Zonder uitleg/categorie (data\curated.json):" -ForegroundColor Yellow; $noCurated | ForEach-Object { Write-Host "  $_" } }
