<?php

namespace App\Http\Requests;

use App\Models\Outlet;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use LogicException;

class ParseVoiceRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->tenant_id !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'outlet_id' => [
                'required',
                'integer',
                Rule::exists(Outlet::class, 'id')
                    ->where(fn (Builder $query): Builder => $query->where('tenant_id', $this->user()?->tenant_id)),
            ],
            'audio' => [
                'required',
                'file',
                'extensions:webm,ogg,mp4,mp3,mpeg,wav',
                'mimetypes:audio/webm,video/webm,audio/ogg,video/ogg,application/ogg,audio/mp4,video/mp4,audio/mpeg,audio/wav,audio/x-wav,audio/wave',
                'max:10240',
            ],
        ];
    }

    /**
     * Ensure the selected outlet is accessible to the authenticated user.
     *
     * @return array<Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->has('outlet_id')) {
                    return;
                }

                /** @var User|null $user */
                $user = $this->user();
                $outletIsAccessible = $user !== null
                    && Outlet::query()
                        ->accessibleTo($user)
                        ->whereKey($this->integer('outlet_id'))
                        ->exists();

                if (! $outletIsAccessible) {
                    $validator->errors()->add('outlet_id', 'The selected outlet is invalid.');
                }
            },
        ];
    }

    /**
     * Get the validated outlet.
     */
    public function outlet(): Outlet
    {
        /** @var User $user */
        $user = $this->user();

        return Outlet::query()
            ->accessibleTo($user)
            ->findOrFail($this->integer('outlet_id'));
    }

    /**
     * Get the validated audio upload.
     */
    public function audio(): UploadedFile
    {
        $audio = $this->file('audio');

        if (! $audio instanceof UploadedFile) {
            throw new LogicException('The validated audio upload is unavailable.');
        }

        return $audio;
    }
}
