<?php

namespace App\Support\Pdf;

use Mpdf\Mpdf;
use RuntimeException;

/**
 * Official Association Frame for every mPDF document.
 * Audit: 11_PDF_REPORT_DESIGN_AUDIT.md sections 5, 7, 14, 16.
 */
final class AssociationFrame
{
    private static string $orientation = 'P';

    public static function open(string $orientation = 'P', bool $compact = false): Mpdf
    {
        self::$orientation = $orientation === 'L' ? 'L' : 'P';
        $metrics = self::metrics($orientation);
        $headerHeight = $metrics['header'];
        $footerHeight = $metrics['footer'];
        $headerWidth = $metrics['page_width'];
        $footerWidth = $metrics['page_width'];
        if ($compact) {
            $headerCap = $orientation === 'L' ? 36.0 : 42.0;
            $footerCap = $orientation === 'L' ? 15.0 : 16.0;
            $headerHeight = min($headerHeight, $headerCap);
            $footerHeight = min($footerHeight, $footerCap);
            $headerWidth = round($metrics['page_width'] * $headerHeight / $metrics['header'], 2);
            $footerWidth = round($metrics['page_width'] * $footerHeight / $metrics['footer'], 2);
        }
        $tempDir = storage_path('app/mpdf');
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0750, true);
        }

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'orientation' => $orientation,
            'margin_top' => $headerHeight + ($compact ? 4 : 4),
            'margin_bottom' => $footerHeight + ($compact ? 7 : 10),
            'margin_left' => 14,
            'margin_right' => 14,
            'margin_header' => 1,
            'margin_footer' => 2,
            'mirrorMargins' => false,
            'autoScriptToLang' => true,
            'autoLangToFont' => false,
            'default_font' => 'xbriyaz',
            'tempDir' => $tempDir,
        ]);

        $header = self::band($metrics['header_path'], $metrics['page_width'], $headerWidth, $headerHeight);
        $footer = '<div style="text-align:center;font-family:xbriyaz;font-size:8pt;color:#3A342C;line-height:1.05;margin:0">صفحة {PAGENO} من {nbpg}</div>'
            .self::band($metrics['footer_path'], $metrics['page_width'], $footerWidth, $footerHeight);

        foreach (['O', 'E'] as $side) {
            $mpdf->SetHTMLHeader($header, $side, $side === 'O');
            $mpdf->SetHTMLFooter($footer, $side);
        }

        return $mpdf;
    }

    public static function frameMarkup(?string $orientation = null): string
    {
        // The content border lives in the letterhead stylesheet.
        // A full-page fixed box overflowed mPDF and created a blank trailing page.
        return '';
    }

    /**
     * @return array{header: float, footer: float, page_width: float, header_path: string, footer_path: string}
     */
    public static function metrics(string $orientation = 'P'): array
    {
        $headerPath = str_replace('\\', '/', public_path('assets/pdf-letterhead-header.jpg'));
        $footerPath = str_replace('\\', '/', public_path('assets/pdf-letterhead-footer.jpg'));
        foreach ([$headerPath, $footerPath] as $imagePath) {
            if (! is_file($imagePath) || ! is_readable($imagePath)) {
                throw new RuntimeException('PDF letterhead image is missing or unreadable.');
            }
        }

        $pageWidth = $orientation === 'L' ? 297.0 : 210.0;

        return [
            'header' => self::heightMm($headerPath, $pageWidth),
            'footer' => self::heightMm($footerPath, $pageWidth),
            'page_width' => $pageWidth,
            'header_path' => $headerPath,
            'footer_path' => $footerPath,
        ];
    }

    private static function heightMm(string $path, float $pageWidthMm): float
    {
        $size = getimagesize($path);
        if ($size === false || $size[0] < 1 || $size[1] < 1) {
            throw new RuntimeException('PDF letterhead image is missing or unreadable.');
        }

        return round($pageWidthMm * $size[1] / $size[0], 2);
    }

    private static function band(string $path, float $pageWidth, float $bandWidth, float $bandHeight): string
    {
        $offset = (($pageWidth - $bandWidth) / 2) - 14;
        $width = self::millimetres($bandWidth);
        $height = self::millimetres($bandHeight);

        return '<div style="margin-left:'.self::millimetres($offset).';width:'.$width.'"><img src="'.$path.'" style="width:'.$width.';height:'.$height.'" alt=""></div>';
    }

    private static function millimetres(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.').'mm';
    }
}
