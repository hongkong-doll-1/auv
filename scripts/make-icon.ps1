Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"
New-Item -ItemType Directory -Force -Path $assets | Out-Null

function New-RoundedRect($x, $y, $w, $h, $r) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

$size = 1024
$bmp = [System.Drawing.Bitmap]::new($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$pad = 64
$tile = New-RoundedRect $pad $pad ($size - 2 * $pad) ($size - 2 * $pad) 190
$rect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
$tileBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, [System.Drawing.Color]::FromArgb(255, 30, 30, 40), [System.Drawing.Color]::FromArgb(255, 6, 6, 10), 135)
$g.FillPath($tileBrush, $tile)
$tilePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(46, 255, 255, 255), 3)
$g.DrawPath($tilePen, $tile)

$ox = 232
$oy = 210
$ow = 560
$oh = 560

$shadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(110, 0, 0, 0))
$g.FillEllipse($shadow, $ox + 14, $oy + 34, $ow, $oh)

$orbRect = [System.Drawing.Rectangle]::new($ox, $oy, $ow, $oh)
$orbBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($orbRect, [System.Drawing.Color]::FromArgb(255, 126, 126, 140), [System.Drawing.Color]::FromArgb(255, 0, 0, 0), 125)
$g.FillEllipse($orbBrush, $orbRect)

$soft = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(70, 255, 255, 255))
$g.FillEllipse($soft, $ox + 90, $oy + 56, 300, 220)

$bright = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
$g.FillEllipse($bright, $ox + 130, $oy + 96, 170, 100)

$glass = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(70, 255, 255, 255))
$g.FillEllipse($glass, $ox + 160, $oy + 392, 240, 86)

$rim = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(130, 255, 255, 255), 4)
$g.DrawEllipse($rim, $ox, $oy, $ow, $oh)

$g.Dispose()

$bmp.Save((Join-Path $assets "icon-1024.png"), [System.Drawing.Imaging.ImageFormat]::Png)

foreach ($s in 256, 128, 64, 48, 32, 16) {
  $nb = [System.Drawing.Bitmap]::new($s, $s)
  $ng = [System.Drawing.Graphics]::FromImage($nb)
  $ng.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $ng.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $ng.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $ng.DrawImage($bmp, 0, 0, $s, $s)
  $ng.Dispose()
  $nb.Save((Join-Path $assets "icon-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $nb.Dispose()
}

$bmp.Dispose()
Write-Output "icons written to $assets"
