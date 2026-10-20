# Troca o dominio em todos os arquivos do site (canonical, og, schema, sitemap, robots, redirects, redirect do form).
# Uso:  .\ferramentas\set-domain.ps1 -Domain novodominio.com -From joseexcavation.com
# (-From e o dominio que esta nos arquivos hoje; padrao: joseexcavation.com)
param(
  [Parameter(Mandatory = $true)][string]$Domain,
  [string]$From = 'joseexcavation.com'
)

$clean = { param($d) $d -replace '^https?://', '' -replace '^www\.', '' -replace '/+$', '' }
$Domain = & $clean $Domain
$From = & $clean $From
$site = (Resolve-Path (Join-Path $PSScriptRoot '..\site')).Path

$files = Get-ChildItem $site -Recurse -File -Include *.html, *.xml, *.txt, .htaccess, _redirects, *.php
foreach ($f in $files) {
  $text = [IO.File]::ReadAllText($f.FullName)
  if (-not $text.Contains($From)) { continue }
  [IO.File]::WriteAllText($f.FullName, $text.Replace($From, $Domain))
  Write-Output ("atualizado: " + $f.FullName.Substring($site.Length))
}
