<?php

namespace App\Support\Pdf;

/**
 * Deterministic print charts. Values are supplied by Governance aggregates.
 */
final class GovernanceCharts
{
    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public static function columns(array $rows): string
    {
        return self::bars(self::pairs($rows, 'label', 'count'), 'الرسم العمودي');
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public static function line(array $rows): string
    {
        $first = self::pairs($rows, 'period', 'registrations');
        $second = self::pairs($rows, 'period', 'distributions');
        if ($first === [] || self::allZero($first) && self::allZero($second)) {
            return self::empty('الرسم الزمني');
        }
        $max = max(1, max(array_merge(array_column($first, 1), array_column($second, 1))));
        $step = count($first) > 1 ? 460 / (count($first) - 1) : 0;
        $series = function (array $points, string $color) use ($max, $step): string {
            $drawn = '';
            $path = '';
            $marks = '';
            foreach (array_values($points) as $index => $pair) {
                $x = round(20 + ($step * $index), 1);
                $y = round(10 + (72 * (1 - ($pair[1] / $max))), 1);
                $path .= ($index === 0 ? 'M ' : ' L ').$x.' '.$y;
                $marks .= '<circle cx="'.$x.'" cy="'.$y.'" r="3" fill="'.$color.'" />';
            }
            if (count($points) > 1) {
                $drawn .= '<path d="'.$path.'" fill="none" stroke="'.$color.'" stroke-width="2.5" />';
            }

            return $drawn.$marks;
        };
        $svg = self::svg(500, 92, 250, $series($first, '#1F4D3A').$series($second, '#A6843D').'<line x1="16" y1="82" x2="484" y2="82" stroke="#C4B48A" stroke-width="1" />');

        return self::wrap('الرسم الزمني', $svg, 'الأخضر: التسجيلات. الذهبي: الدعم المكتمل.');
    }

    /**
     * @param  array<int, array<string, mixed>>  $stages
     */
    public static function funnel(array $stages): string
    {
        [$title, $body, $legend] = self::funnelPieces($stages);

        return $body === '' ? self::empty($title) : self::wrap($title, $body, $legend);
    }

    /**
     * @param  array<int, array<string, mixed>>  $stages
     * @param  array<int, array<string, mixed>>  $rows
     */
    public static function distribution(array $stages, array $rows): string
    {
        [$funnelTitle, $funnelBody, $funnelLegend] = self::funnelPieces($stages);
        [$pieTitle, $pieBody, $pieLegend] = self::piePieces($rows);
        $picture = function (string $body): string {
            return $body === '' ? '<p>لا توجد بيانات كافية خلال الفترة المحددة</p>' : $body;
        };

        return '<table class="pair">'
            .'<tr><td><h3>'.e($funnelTitle).'</h3></td><td><h3>'.e($pieTitle).'</h3></td></tr>'
            .'<tr><td>'.$picture($funnelBody).'</td><td>'.$picture($pieBody).'</td></tr>'
            .'<tr><td><p class="muted">'.$funnelLegend.'</p></td><td><p class="muted">'.$pieLegend.'</p></td></tr>'
            .'</table>';
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public static function pie(array $rows): string
    {
        [$title, $body, $legend] = self::piePieces($rows);

        return $body === '' ? self::empty($title) : self::wrap($title, $body, $legend);
    }

    /**
     * @param  array<int, array<string, mixed>>  $stages
     * @return array{0: string, 1: string, 2: string}
     */
    private static function funnelPieces(array $stages): array
    {
        $pairs = self::pairs($stages, 'stage', 'count');
        if ($pairs === [] || self::allZero($pairs)) {
            return ['رسم القمع', '', ''];
        }
        $max = max(1, max(array_column($pairs, 1)));
        $band = max(10, (int) floor(108 / max(1, count($pairs))));
        $shapes = '';
        $y = 8;
        foreach ($pairs as $pair) {
            $bar = max(22, (int) round(200 * $pair[1] / $max));
            $x = (int) ((220 - $bar) / 2);
            $shapes .= '<rect x="'.$x.'" y="'.$y.'" width="'.$bar.'" height="'.max(6, $band - 4).'" fill="#1F4D3A" />';
            $y += $band;
        }

        return ['رسم القمع', self::svg(220, 124, 112, $shapes), self::inlineLegend($pairs)];
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{0: string, 1: string, 2: string}
     */
    private static function piePieces(array $rows): array
    {
        $pairs = array_values(array_filter(self::pairs($rows, 'label', 'count'), fn ($pair) => $pair[1] > 0));
        if ($pairs === []) {
            return ['الرسم الدائري', '', ''];
        }
        $total = array_sum(array_column($pairs, 1));
        $colors = ['#1F4D3A', '#A6843D', '#3D6B58', '#C4B48A', '#6E8F7A'];
        $angle = -90.0;
        $slices = '';
        foreach ($pairs as $index => $pair) {
            $sweep = 360 * $pair[1] / $total;
            $slices .= self::slice(110, 62, 52, $angle, $angle + $sweep, $colors[$index % count($colors)]);
            $angle += $sweep;
        }

        return ['الرسم الدائري', self::svg(220, 124, 112, $slices), self::inlineLegend($pairs)];
    }

    /**
     * @param  array<int, array{0: string, 1: int}>  $pairs
     */
    private static function bars(array $pairs, string $title): string
    {
        if ($pairs === [] || self::allZero($pairs)) {
            return self::empty($title);
        }
        $max = max(1, max(array_column($pairs, 1)));
        $slot = 468 / max(1, count($pairs));
        $barWidth = min(150, max(22, (int) ($slot * 0.7)));
        $rects = '<line x1="16" y1="82" x2="484" y2="82" stroke="#C4B48A" stroke-width="1" />';
        foreach ($pairs as $index => $pair) {
            $bar = max(3, (int) round(70 * $pair[1] / $max));
            $x = (int) (16 + $index * $slot + ($slot - $barWidth) / 2);
            $y = 82 - $bar;
            $rects .= '<rect x="'.$x.'" y="'.$y.'" width="'.$barWidth.'" height="'.$bar.'" fill="#1F4D3A" />';
        }
        $svg = self::svg(500, 92, 250, $rects);
        $legend = self::inlineLegend($pairs);

        return self::wrap($title, $svg, $legend);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array{0: string, 1: int}>
     */
    private static function pairs(array $rows, string $label, string $value): array
    {
        $pairs = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $pairs[] = [(string) ($row[$label] ?? ''), (int) ($row[$value] ?? 0)];
        }

        return $pairs;
    }

    /**
     * @param  array<int, array{0: string, 1: int}>  $pairs
     */
    private static function allZero(array $pairs): bool
    {
        foreach ($pairs as $pair) {
            if ($pair[1] > 0) {
                return false;
            }
        }

        return true;
    }

    private static function empty(string $title): string
    {
        return '<h3>'.e($title).'</h3><p>لا توجد بيانات كافية خلال الفترة المحددة</p>';
    }

    private static function svg(int $viewWidth, int $viewHeight, int $widthMm, string $shapes): string
    {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="'.$widthMm.'mm" viewBox="0 0 '.$viewWidth.' '.$viewHeight.'">'.$shapes.'</svg>';
    }

    /**
     * @param  array<int, array{0: string, 1: int}>  $pairs
     */
    private static function inlineLegend(array $pairs): string
    {
        $parts = [];
        foreach ($pairs as $pair) {
            $parts[] = e($pair[0]).' '.$pair[1];
        }

        return implode(' · ', $parts);
    }

    private static function wrap(string $title, string $svg, string $legend): string
    {
        return '<div class="chart" style="page-break-inside:avoid"><h3>'.e($title).'</h3>'.$svg.'<p class="muted">'.$legend.'</p></div>';
    }

    private static function slice(float $cx, float $cy, float $radius, float $start, float $end, string $color): string
    {
        $span = $end - $start;
        if ($span >= 359.9) {
            return '<circle cx="'.$cx.'" cy="'.$cy.'" r="'.$radius.'" fill="'.$color.'" />';
        }
        $startRad = deg2rad($start);
        $endRad = deg2rad($end);
        $x1 = round($cx + $radius * cos($startRad), 2);
        $y1 = round($cy + $radius * sin($startRad), 2);
        $x2 = round($cx + $radius * cos($endRad), 2);
        $y2 = round($cy + $radius * sin($endRad), 2);
        $large = $span > 180 ? 1 : 0;

        return '<path d="M '.$cx.' '.$cy.' L '.$x1.' '.$y1.' A '.$radius.' '.$radius.' 0 '.$large.' 1 '.$x2.' '.$y2.' Z" fill="'.$color.'" />';
    }
}
