<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\IOFactory;

class SmartExcelImportService
{
    public function read(UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        if (! in_array($extension, ['xlsx', 'xls', 'csv'], true)) {
            throw new \InvalidArgumentException('صيغة الملف غير مدعومة. استخدم XLSX أو XLS أو CSV.');
        }

        $reader = IOFactory::createReaderForFile($file->getRealPath());
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($file->getRealPath());

        $sheets = [];
        foreach ($spreadsheet->getWorksheetIterator() as $worksheet) {
            $matrix = $worksheet->toArray('', true, true, false);
            $matrix = array_values(array_filter($matrix, fn ($row) => count(array_filter($row, fn ($v) => trim((string) $v) !== '')) > 0));
            if (count($matrix) < 2) {
                continue;
            }

            $headerIndex = $this->detectHeaderRow($matrix);
            $headers = array_map(fn ($value, $index) => trim((string) $value) ?: 'عمود '.($index + 1), $matrix[$headerIndex], array_keys($matrix[$headerIndex]));
            $rows = [];
            foreach (array_slice($matrix, $headerIndex + 1) as $values) {
                $values = array_pad(array_slice($values, 0, count($headers)), count($headers), '');
                if (count(array_filter($values, fn ($v) => trim((string) $v) !== '')) === 0) {
                    continue;
                }
                $rows[] = array_combine($headers, array_map(fn ($v) => trim((string) $v), $values));
            }

            if ($rows) {
                $sheets[] = ['name' => $worksheet->getTitle(), 'headers' => $headers, 'rows' => $rows];
            }
        }

        if (! $sheets) {
            throw new \InvalidArgumentException('لم يتم العثور على جدول يحتوي على صف عناوين وبيانات.');
        }

        return $sheets;
    }

    public function suggest(array $headers, array $fields): array
    {
        $result = [];
        foreach ($headers as $header) {
            $normalized = $this->normalize($header);
            $bestField = null;
            $bestScore = 0;
            foreach ($fields as $field => $definition) {
                foreach (array_merge([$field, $definition['label']], $definition['aliases'] ?? []) as $alias) {
                    $candidate = $this->normalize($alias);
                    $score = $normalized === $candidate ? 100 : 0;
                    if (! $score && mb_strlen($candidate) >= 3 && (str_contains($normalized, $candidate) || str_contains($candidate, $normalized))) {
                        $score = 80;
                    }
                    if ($score > $bestScore) {
                        $bestScore = $score;
                        $bestField = $field;
                    }
                }
            }
            $result[$header] = $bestScore >= 80 ? $bestField : null;
        }

        return $result;
    }

    public function mapRows(array $rows, array $mapping): array
    {
        return array_map(function ($row) use ($mapping) {
            $mapped = [];
            foreach ($mapping as $source => $target) {
                if ($target && array_key_exists($source, $row)) {
                    $mapped[$target] = $row[$source];
                }
            }

            return $mapped;
        }, $rows);
    }

    private function detectHeaderRow(array $matrix): int
    {
        $limit = min(10, count($matrix) - 1);
        $bestIndex = 0;
        $bestScore = -1;
        for ($i = 0; $i <= $limit; $i++) {
            $nonEmpty = array_values(array_filter($matrix[$i], fn ($v) => trim((string) $v) !== ''));
            $textCells = count(array_filter($nonEmpty, fn ($v) => ! is_numeric($v)));
            $score = count($nonEmpty) + ($textCells * 2);
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestIndex = $i;
            }
        }

        return $bestIndex;
    }

    private function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = str_replace(['أ', 'إ', 'آ', 'ٱ', 'ة', 'ى'], ['ا', 'ا', 'ا', 'ا', 'ه', 'ي'], $value);

        return preg_replace('/[^\p{L}\p{N}]/u', '', $value) ?? '';
    }
}
