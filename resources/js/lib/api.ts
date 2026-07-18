export type ApiRoute = {
    url: string;
    method: string;
};

type ApiErrorBody = {
    message?: string;
    errors?: Record<string, string[]>;
};

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly body: ApiErrorBody | null,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const cookie = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(`${name}=`));

    if (!cookie) {
        return null;
    }

    try {
        return decodeURIComponent(cookie.slice(name.length + 1));
    } catch {
        return cookie.slice(name.length + 1);
    }
}

function getSameOriginUrl(url: string): string {
    if (typeof window === 'undefined') {
        return url;
    }

    const resolvedUrl = new URL(url, window.location.origin);

    if (resolvedUrl.origin !== window.location.origin) {
        throw new Error('Permintaan hanya boleh dikirim ke server Amanah.');
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
        return response.json();
    }

    const text = await response.text();

    return text === '' ? null : text;
}

function getApiErrorMessage(body: unknown, fallback: string): string {
    if (body && typeof body === 'object') {
        const apiBody = body as ApiErrorBody;

        if (apiBody.message) {
            return apiBody.message;
        }

        const firstValidationMessage = Object.values(
            apiBody.errors ?? {},
        )[0]?.[0];

        if (firstValidationMessage) {
            return firstValidationMessage;
        }
    }

    return fallback;
}

export async function apiRequest<T>(
    route: ApiRoute,
    data?: FormData | Record<string, unknown>,
    signal?: AbortSignal,
): Promise<T> {
    const headers = new Headers({
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    });
    const xsrfToken = getCookie('XSRF-TOKEN');

    if (xsrfToken) {
        headers.set('X-XSRF-TOKEN', xsrfToken);
    }

    let body: BodyInit | undefined;

    if (data instanceof FormData) {
        body = data;
    } else if (data !== undefined) {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(data);
    }

    const response = await fetch(getSameOriginUrl(route.url), {
        method: route.method.toUpperCase(),
        headers,
        body,
        credentials: 'same-origin',
        signal,
    });
    const responseBody = await readResponseBody(response);

    if (!response.ok) {
        const errorBody =
            responseBody && typeof responseBody === 'object'
                ? (responseBody as ApiErrorBody)
                : null;

        throw new ApiError(
            getApiErrorMessage(
                responseBody,
                `Permintaan gagal (${response.status})`,
            ),
            response.status,
            errorBody,
        );
    }

    return responseBody as T;
}

export function isNetworkError(error: unknown): boolean {
    return (
        error instanceof TypeError ||
        (typeof navigator !== 'undefined' && !navigator.onLine)
    );
}

export function getRequestErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return 'Terjadi kesalahan. Silakan coba lagi.';
}
