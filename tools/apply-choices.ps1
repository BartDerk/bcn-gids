# Eenmalig: zet de gekozen gevelfoto's (naam -> kandidaatnummer) als "file" in data\curated.json
$root = Split-Path $PSScriptRoot -Parent
$c = Get-Content (Join-Path $PSScriptRoot 'cand\candidates.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$pick = [ordered]@{
  "Museu Picasso" = 1; "Palau de la M" = 0
}
$pick = [ordered]@{}
$pick["Museu Picasso"] = 1
$pick["Mercat de Santa Caterina"] = 1
$pick["MEAM Museum"] = 2
$pick["Parc de l'Espa" + [char]0xF1 + "a Industrial"] = 4
$pick["Parc Diagonal Mar"] = 2
$pick["Sant Pau del Camp"] = 4
$pick["Palau Ramon Montaner"] = 2
$pick["palais du baron de Quadras"] = 3
$pick["Casa Planells"] = 1
$pick["Mercat de Sant Antoni"] = 1
$pick["Mercat de la Barceloneta"] = 1
$pick["Jardins de Moss" + [char]0xE8 + "n Costa i Llobera"] = 3
$pick["Bunkers del Carmel"] = 3
$pick["Casa Comalat"] = 1
$pick["Casa Bur" + [char]0xE9 + "s"] = 3
$pick["Dip" + [char]0xF2 + "sit de les Aig" + [char]0xFC + "es"] = 2
$pick["Il" + [char]0xB7 + "lustre Col" + [char]0xB7 + "legi de l'Advocacia de Barcelona"] = 2
$pick["Casa Pia Batll" + [char]0xF3] = 1
$pick["Carrer Gran de Gr" + [char]0xE0 + "cia"] = 3
$pick["Fanals d'Antoni Gaud" + [char]0xED] = 1
$pick["Palau de la M" + [char]0xFA + "sica Catalana"] = 6
$path = Join-Path $root 'data\curated.json'
$t = Get-Content $path -Raw -Encoding UTF8
foreach ($k in $pick.Keys) {
  $entry = $c.PSObject.Properties | Where-Object { $_.Name -ceq $k } | Select-Object -First 1
  if (-not $entry) { Write-Host "geen kandidaten voor $k"; continue }
  $f = ($entry.Value | Where-Object { $_.n -eq $pick[$k] }).file
  $re = '("' + [regex]::Escape($k) + '": \{"cat": "[a-z]+",)'
  if (-not [regex]::IsMatch($t, $re)) { Write-Host "niet gevonden in curated.json: $k"; continue }
  $t = [regex]::Replace($t, $re, ('$1 "file": "' + $f.Replace('$', '$$') + '",'), 1)
  Write-Host "$k -> $f"
}
[IO.File]::WriteAllText($path, $t, (New-Object Text.UTF8Encoding $false))
