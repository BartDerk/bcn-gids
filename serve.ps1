# Eenvoudige statische server voor lokaal testen: .\serve.ps1  (http://localhost:8080)
$root = $PSScriptRoot; $port = 8080
$types = @{'.html'='text/html; charset=utf-8';'.css'='text/css';'.js'='text/javascript';'.json'='application/json';'.webmanifest'='application/manifest+json';'.png'='image/png';'.svg'='image/svg+xml'}
$l = New-Object Net.HttpListener; $l.Prefixes.Add("http://localhost:$port/"); $l.Start()
Write-Host "Server op http://localhost:$port/ (Ctrl+C om te stoppen)"
while ($l.IsListening) {
  $c = $l.GetContext(); $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath).TrimStart('/')
  if ($p -eq '') { $p = 'index.html' }
  $f = Join-Path $root $p
  if ((Test-Path $f -PathType Leaf) -and $f.StartsWith($root)) {
    $b = [IO.File]::ReadAllBytes($f); $ext = [IO.Path]::GetExtension($f)
    $c.Response.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $c.Response.OutputStream.Write($b,0,$b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
