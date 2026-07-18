<?php

use App\Enums\OutletUserRole;
use App\Models\Category;
use App\Models\Outlet;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Voice\UnavailableVoiceParser;
use App\Services\Voice\VoiceParserService;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    $this->user = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->user->assignRole(OutletUserRole::Owner->value);
    $this->outlet = Outlet::factory()->create(['tenant_id' => $this->tenant->id]);
    $this->exactCategory = Category::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'name' => 'Rokok Surya 16',
    ]);
    $this->phraseCategory = Category::factory()->create([
        'tenant_id' => $this->tenant->id,
        'outlet_id' => $this->outlet->id,
        'name' => 'Kopi',
    ]);

    Sanctum::actingAs($this->user);
});

it('parses an uploaded voice note successfully', function () {
    $file = UploadedFile::fake()->create('voicenote.webm', 100, 'audio/webm');

    $this->postJson('/api/voice/parse', [
        'outlet_id' => $this->outlet->id,
        'audio' => $file,
    ])
        ->assertOk()
        ->assertJsonPath('data.status', 'success')
        ->assertJsonPath('data.transcript', 'Satu bungkus Rokok Surya 16 dan dua sachet Kopi Kapal Api, bayar tiga puluh lima ribu.')
        ->assertJsonPath('data.total_amount', 33000)
        ->assertJsonPath('data.items.0.category_id', $this->exactCategory->id)
        ->assertJsonPath('data.items.0.confidence', 1)
        ->assertJsonPath('data.items.0.needs_review', false)
        ->assertJsonPath('data.items.1.category_id', $this->phraseCategory->id)
        ->assertJsonPath('data.items.1.confidence', 0.9)
        ->assertJsonPath('data.items.1.needs_review', false)
        ->assertJsonCount(0, 'data.warnings');
});

it('requires an outlet and audio file to parse', function () {
    $this->postJson('/api/voice/parse', [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['outlet_id', 'audio']);
});

it('accepts supported voice recording mime types', function (string $extension, string $mimeType) {
    $file = UploadedFile::fake()->create("voicenote.{$extension}", 100, $mimeType);

    $this->postJson('/api/voice/parse', [
        'outlet_id' => $this->outlet->id,
        'audio' => $file,
    ])->assertOk();
})->with([
    'webm' => ['webm', 'audio/webm'],
    'ogg' => ['ogg', 'audio/ogg'],
    'mp4' => ['mp4', 'audio/mp4'],
    'mpeg' => ['mp3', 'audio/mpeg'],
    'wav' => ['wav', 'audio/wav'],
]);

it('rejects unsupported or oversized audio files', function (UploadedFile $file) {
    $this->postJson('/api/voice/parse', [
        'outlet_id' => $this->outlet->id,
        'audio' => $file,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('audio');
})->with([
    'unsupported mime' => fn () => UploadedFile::fake()->create('notes.txt', 100, 'text/plain'),
    'supported mime with invalid extension' => fn () => UploadedFile::fake()->create('voice.txt', 100, 'audio/webm'),
    'larger than ten megabytes' => fn () => UploadedFile::fake()->create('voice.webm', 10_241, 'audio/webm'),
]);

it('marks the response for review when an item cannot map to an active category', function () {
    $this->phraseCategory->update(['is_active' => false]);
    $file = UploadedFile::fake()->create('voicenote.webm', 100, 'audio/webm');

    $this->postJson('/api/voice/parse', [
        'outlet_id' => $this->outlet->id,
        'audio' => $file,
    ])
        ->assertOk()
        ->assertJsonPath('data.status', 'needs_review')
        ->assertJsonPath('data.items.1.category_id', null)
        ->assertJsonPath('data.items.1.confidence', 0)
        ->assertJsonPath('data.items.1.needs_review', true)
        ->assertJsonCount(1, 'data.warnings');
});

it('rejects an outlet that is not accessible to a penjaga', function () {
    $penjaga = User::factory()->create(['tenant_id' => $this->tenant->id]);
    $penjaga->assignRole(OutletUserRole::Penjaga->value);
    Sanctum::actingAs($penjaga);
    $file = UploadedFile::fake()->create('voicenote.webm', 100, 'audio/webm');

    $this->postJson('/api/voice/parse', [
        'outlet_id' => $this->outlet->id,
        'audio' => $file,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('outlet_id');
});

it('rejects an outlet from another tenant', function () {
    $otherTenant = Tenant::factory()->create();
    $otherOutlet = Outlet::factory()->create(['tenant_id' => $otherTenant->id]);
    $file = UploadedFile::fake()->create('voicenote.webm', 100, 'audio/webm');

    $this->postJson('/api/voice/parse', [
        'outlet_id' => $otherOutlet->id,
        'audio' => $file,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('outlet_id');
});

it('fails closed when no voice parser driver is configured', function () {
    app()->bind(VoiceParserService::class, UnavailableVoiceParser::class);
    $file = UploadedFile::fake()->create('voicenote.webm', 100, 'audio/webm');

    $this->postJson('/api/voice/parse', [
        'outlet_id' => $this->outlet->id,
        'audio' => $file,
    ])->assertStatus(503);
});

it('throttles excessive voice parse requests', function () {
    $file = fn () => UploadedFile::fake()->create('voicenote.webm', 100, 'audio/webm');

    foreach (range(1, 20) as $attempt) {
        $this->postJson('/api/voice/parse', [
            'outlet_id' => $this->outlet->id,
            'audio' => $file(),
        ])->assertOk();
    }

    $this->postJson('/api/voice/parse', [
        'outlet_id' => $this->outlet->id,
        'audio' => $file(),
    ])->assertStatus(429);
});
