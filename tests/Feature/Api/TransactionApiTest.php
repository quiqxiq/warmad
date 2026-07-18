<?php

it('does not expose the legacy single transaction endpoint', function () {
    $this->postJson('/api/transactions', [])->assertMethodNotAllowed();
});
