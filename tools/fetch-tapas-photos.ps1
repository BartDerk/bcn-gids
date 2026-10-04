# Haalt per tapa een foto van Wikimedia Commons (breedte 400px) en schrijft data\tapas-photos.json.
# $pick: index in data\tapas.json -> bestandsnaam op Commons (handmatig gekozen). Bestaande foto's worden overgeslagen.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object Text.UTF8Encoding $false
$ua = 'bcn-reisgids/1.0 (persoonlijk reisproject)'
$tapas = Get-Content (Join-Path $root 'data\tapas.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$pick = @{
 0='Berenjena frita (España).jpg'; 1='Alitas de pollo casera.jpg'; 3='Anxoves.jpg'
 6='Botifarra amb seques.JPG'; 7='Butifarra negra.jpg'; 8='Buñuelos de bacalao.jpg'; 9='Calamares a la romana. Fritura.jpg'
 11='Cap i pota.jpg'; 12='Cargols a la llauna.JPG'; 14='Almejas a la marinera-2009.jpg'; 15='Coca de recapte.jpg'
 16='Croquetas de bacalao, patata cocida, huevo, ajo y perejil (España).jpg'; 17='Croquetas Caseras (7068664101).jpg'
 18='Croquetas de jamón - lacestabar.jpg'; 19='Jamón y embutidos ibéricos de bellota.jpg'; 20='Empanadillas.jpg'; 21='Escalivada.jpg'
 22='Cerastoderma edule 01.jpg'; 23='Spinach catalan style - Espinacas a la catalana (4645147728).jpg'; 24='Esqueixada.jpg'
 26='Queso Manchego con Membrillo (3578359194).jpg'; 27='Fricandó.jpg'; 28='Katalansky fuet Catalan fuet.jpg'; 29='Carrillada de cerdo al horno.jpg'
 30='Gambas al ajillo, 2024.jpg'; 31='Gambas a la plancha-Mad.jpg'; 32='Gazpacho andaluz.jpg'; 33='Albóndigas con puré de papas.jpg'
 34='Mandonguilles amb sípia Carlos i Simo JPO CC Baix Emoprdà.jpg'; 35='100 Montaditos (49287360436).jpg'
 36='Barcelona - Mejillones marinera.jpg'; 37='Tigres- Mejillón rebozado.JPG'; 39='Aceitunas coloradas.jpg'
 40='Huevos rotos con jamón.jpg'; 41='Huevos rellenos de atún y mayonesa casera (España).jpg'; 42='Pa amb tomàquet - 001.jpg'
 43='Patatas bravas. Tapa de bar (España).jpg'; 44='Pimientos de Padrón - 2.jpg'; 45='Pimientos del piquillo rellenos en cazuela.jpg'
 46='Jamón ibérico tapa.jpg'; 47='Pincho moruno-Valladolid.jpg'; 48='El Pulpo a la gallega, típica tapa española.jpg'
 49='Sardinas a la plancha-2009.jpg'; 50='Boquerones en vinagre.jpg'; 52='Sepia a la plancha o "Enterita".jpg'
 53='Tellinas a la marinera.jpg'; 54='Tortilla de Patatas (Corte transversal).jpg'; 55='Champiñones al ajillo (Madrid).jpg'
 56='Chipirones fritos Barcelona 2024.jpg'; 57='Chistorra - Ración.JPG'
}
function Get($url, $out) {
  for ($t = 0; $t -lt 6; $t++) {
    try { if ($out) { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -UserAgent $ua; return } else { return Invoke-RestMethod -Uri $url -UserAgent $ua } }
    catch { Start-Sleep -Seconds (15 * ($t + 1)) }
  }
  throw "mislukt: $url"
}
$outDir = Join-Path $root 'photos\tapas'; New-Item -ItemType Directory -Force $outDir | Out-Null
$jsonPath = Join-Path $root 'data\tapas-photos.json'
$res = [ordered]@{}
if (Test-Path $jsonPath) { (Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | % { $res[$_.Name] = $_.Value } }
foreach ($i in ($pick.Keys | sort)) {
  $ca = $tapas[$i].ca; $file = "photos/tapas/$('{0:00}' -f $i).jpg"
  if ($res.Contains($ca) -and (Test-Path (Join-Path $root $file))) { continue }
  try {
    $meta = Get ("https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&titles=" + [Uri]::EscapeDataString("File:" + $pick[$i])) $null
    $ii = ($meta.query.pages.PSObject.Properties | select -First 1).Value.imageinfo; $info = $null; if ($ii) { $info = $ii[0].extmetadata }
    $artist = ''; if ($info -and $info.Artist) { $artist = ($info.Artist.value -replace '<[^>]+>', '').Trim() }; if (-not $artist) { $artist = 'onbekend' }
    $lic = 'vrije licentie'; if ($info -and $info.LicenseShortName) { $lic = $info.LicenseShortName.value }
    Get ("https://commons.wikimedia.org/wiki/Special:FilePath/" + [Uri]::EscapeDataString($pick[$i]) + "?width=400") (Join-Path $root $file)
    $res[$ca] = [pscustomobject]@{ file = $file; credit = "$artist, $lic, Wikimedia Commons" }
    Write-Host "OK $i $ca"
  } catch { Write-Host "FOUT $i $ca : $($_.Exception.Message)" }
  [IO.File]::WriteAllText($jsonPath, ($res | ConvertTo-Json -Depth 3), $utf8)
  Start-Sleep -Seconds 3
}
[IO.File]::WriteAllText($jsonPath, ($res | ConvertTo-Json -Depth 3), $utf8)
Write-Host "klaar: $($res.Count) foto's"
