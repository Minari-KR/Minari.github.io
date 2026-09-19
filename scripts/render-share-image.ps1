# Optional Windows design source. The PNG is checked in; the site build needs only Node.js.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskOutput = Join-Path $taskRoot 'public/assets/images/minari-share.png'
$bitmap = [System.Drawing.Bitmap]::new(1200, 630)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$resources = [System.Collections.Generic.List[System.IDisposable]]::new()
function Brush($hex) {
  $value = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
  $resources.Add($value)
  return $value
}
function Text($value, $size, $x, $y, $brush, $bold = $false) {
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  $font = [System.Drawing.Font]::new('Malgun Gothic', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
  try { $graphics.DrawString($value, $font, $brush, [single]$x, [single]$y) } finally { $font.Dispose() }
}
try {
  $paper = Brush '#fffefa'
  $green = Brush '#1f4f43'
  $ink = Brush '#20211f'
  $muted = Brush '#4f544d'
  $graphics.Clear([System.Drawing.Color]::White)
  $grid = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(52, 116, 186, 220), 1)
  $resources.Add($grid)
  for ($x = 0; $x -lt 1200; $x += 32) { $graphics.DrawLine($grid, $x, 0, $x, 630) }
  for ($y = 0; $y -lt 630; $y += 32) { $graphics.DrawLine($grid, 0, $y, 1200, $y) }
  $card = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $resources.Add($card)
  $card.AddArc(56, 54, 48, 48, 180, 90)
  $card.AddArc(1096, 54, 48, 48, 270, 90)
  $card.AddArc(1096, 528, 48, 48, 0, 90)
  $card.AddArc(56, 528, 48, 48, 90, 90)
  $card.CloseFigure()
  $graphics.FillPath($paper, $card)
  $line = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#dde1dc'), 1)
  $resources.Add($line)
  $graphics.DrawPath($line, $card)
  $graphics.SetClip($card)
  $graphics.FillRectangle($green, 56, 54, 1088, 7)
  $graphics.ResetClip()
  Text 'GAME SYSTEM DESIGNER' 21 108 99 $green $true
  Text 'Minari' 100 104 151 $green $true
  Text '박종찬' 34 465 222 $ink $true
  Text '아이디어를 프로토타입으로 만들고,' 33 110 309 $ink $true
  Text '플레이하며 재미를 검증합니다.' 33 110 359 $ink $true
  $graphics.DrawLine($line, 112, 457, 1088, 457)
  Text 'PORTFOLIO' 21 110 494 $green $true
  Text 'Reflectory  /  Barrel Good Barrel' 23 710 491 $muted
  $bitmap.Save($taskOutput, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $taskOutput
} finally {
  foreach ($resource in $resources) { $resource.Dispose() }
  $graphics.Dispose()
  $bitmap.Dispose()
}
