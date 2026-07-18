<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ParseVoiceRequest;
use App\Models\Category;
use App\Services\Voice\VoiceParserService;
use App\Services\Voice\VoiceParserUnavailableException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class VoiceParserController extends Controller
{
    /**
     * Parse an uploaded audio voice note.
     */
    public function parse(ParseVoiceRequest $request, VoiceParserService $voiceParserService): JsonResponse
    {
        try {
            $result = $voiceParserService->parse($request->audio());
        } catch (VoiceParserUnavailableException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        $categories = $request->outlet()
            ->categories()
            ->where('is_active', true)
            ->orderBy('position')
            ->orderBy('id')
            ->get(['id', 'name']);
        $items = is_array($result['items'] ?? null) ? $result['items'] : [];
        $warnings = is_array($result['warnings'] ?? null) ? array_values($result['warnings']) : [];
        $normalizedItems = [];
        $needsReview = false;

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $normalizedItem = $this->augmentItem($item, $categories);
            $normalizedItems[] = $normalizedItem;

            if ($normalizedItem['category_id'] === null) {
                $needsReview = true;
                $itemName = filled($normalizedItem['name'] ?? null)
                    ? " '{$normalizedItem['name']}'"
                    : '';
                $warnings[] = "No active category matched voice item{$itemName}.";
            }
        }

        $result['status'] = $needsReview
            ? 'needs_review'
            : (is_string($result['status'] ?? null) ? $result['status'] : 'success');
        $result['transcript'] = is_string($result['transcript'] ?? null) ? $result['transcript'] : '';
        $result['items'] = $normalizedItems;
        $result['warnings'] = $warnings;

        return response()->json(['data' => $result]);
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  Collection<int, Category>  $categories
     * @return array<string, mixed>
     */
    private function augmentItem(array $item, Collection $categories): array
    {
        [$categoryId, $matchConfidence] = $this->matchCategory(
            (string) ($item['name'] ?? ''),
            $categories,
        );
        $confidence = is_numeric($item['confidence'] ?? null)
            ? (float) $item['confidence']
            : $matchConfidence;

        return [
            ...$item,
            'category_id' => $categoryId,
            'confidence' => $confidence,
            'needs_review' => $categoryId === null || (bool) ($item['needs_review'] ?? false),
        ];
    }

    /**
     * @param  Collection<int, Category>  $categories
     * @return array{int|null, float}
     */
    private function matchCategory(string $itemName, Collection $categories): array
    {
        $normalizedItemName = $this->normalizeName($itemName);

        if ($normalizedItemName === '') {
            return [null, 0.0];
        }

        $matches = [];

        foreach ($categories as $category) {
            $normalizedCategoryName = $this->normalizeName($category->name);

            if ($normalizedCategoryName !== '' && Str::contains($normalizedItemName, $normalizedCategoryName)) {
                $matches[] = [
                    'id' => $category->id,
                    'name' => $normalizedCategoryName,
                ];
            }
        }

        if ($matches === []) {
            return [null, 0.0];
        }

        usort($matches, function (array $left, array $right): int {
            $lengthComparison = Str::length($right['name']) <=> Str::length($left['name']);

            return $lengthComparison !== 0
                ? $lengthComparison
                : $left['id'] <=> $right['id'];
        });

        return [
            $matches[0]['id'],
            $matches[0]['name'] === $normalizedItemName ? 1.0 : 0.9,
        ];
    }

    private function normalizeName(string $name): string
    {
        return Str::of($name)
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->squish()
            ->toString();
    }
}
