<?php

use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

it('applies Sanctum stateful middleware to API routes', function () {
    expect(app('router')->getMiddlewareGroups()['api'])
        ->toContain(EnsureFrontendRequestsAreStateful::class);
});
