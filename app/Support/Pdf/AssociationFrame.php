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

    public static function open(string $orientation = 'P'): Mpdf
    {
        self::$orientation = $orientation === 'L' ? 'L' : 'P';
        $metrics = self::metrics($orientation);
        $tempDir = storage_path('app/mpdf');
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0750, true);
        }

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'orientation' => $orientation,
            'margin_top' => $metrics['header'] + 4,
            'margin_bottom' => $metrics['footer'] + 10,
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

        $width = self::millimetres($metrics['page_width']);
        $header = '<div style="margin-left:-14mm;width:'.$width.'"><img src="'.$metrics['header_path'].'" style="width:'.$width.';height:'.self::millimetres($metrics['header']).'" alt=""></div>';
        $footer = '<div style="text-align:center;font-family:xbriyaz;font-size:8pt;color:#3A342C">صفحة {PAGENO} من {nbpg}</div>'
            .'<div style="margin-left:-14mm;width:'.$width.'"><img src="'.$metrics['footer_path'].'" style="width:'.$width.';height:'.self::millimetres($metrics['footer']).'" alt=""></div>';

        foreach (['O', 'E'] as $side) {
            $mpdf->SetHTMLHeader($header, $side, $side === 'O');
            $mpdf->SetHTMLFooter($footer, $side);
        }

        return $mpdf;
    }

    public static function frameMarkup(?string $orientation = null): string
    {
        $orientation = $orientation === 'L' || ($orientation === null && self::$orientation === 'L') ? 'L' : 'P';
        $metrics = self::metrics($orientation);
        $pageHeight = $orientation === 'L' ? 210.0 : 297.0;
        $marginTop = $metrics['header'] + 4;
        $marginBottom = $metrics['footer'] + 10;
        // mPDF position:fixed is relative to the body content box, which already
        // starts below the header margin. Do not add the header height again.
        $top = -2;
        $left = -4;
        $width = $metrics['page_width'] - 20;
        $height = max(20, $pageHeight - $marginTop - $marginBottom - 4);

        return '<div style="position:fixed;left:'.$left.'mm;top:'.$top.'mm;width:'.$width.'mm;height:'.$height.'mm;border:0.6mm solid #1F4D3A;">&nbsp;</div>';
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

    private static function millimetres(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.').'mm';
    }
}
