import { Head, router } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, apiRequest, getRequestErrorMessage } from '@/lib/api';
import { register } from '@/routes';
import {
    request as requestOtp,
    verify as verifyOtp,
} from '@/routes/api/auth/otp';

const OTP_LENGTH = 6;

type VerifyResponse = {
    redirect: string;
};

type Step = 'phone' | 'code';

export default function Login() {
    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | undefined>();

    async function handleRequestOtp(event: React.FormEvent) {
        event.preventDefault();
        setProcessing(true);
        setError(undefined);

        try {
            const response = await apiRequest<{ message: string }>(
                requestOtp(),
                { phone },
            );
            toast.success(response.message);
            setStep('code');
        } catch (caught) {
            setError(resolveFieldError(caught, 'phone'));
        } finally {
            setProcessing(false);
        }
    }

    async function handleVerifyOtp(event: React.FormEvent) {
        event.preventDefault();
        setProcessing(true);
        setError(undefined);

        try {
            const response = await apiRequest<VerifyResponse>(verifyOtp(), {
                phone,
                code,
            });
            // The server established the session cookie; hand off to Inertia.
            router.visit(response.redirect);
        } catch (caught) {
            setCode('');
            setError(resolveFieldError(caught, 'code'));
        } finally {
            setProcessing(false);
        }
    }

    return (
        <>
            <Head title="Masuk" />

            {step === 'phone' ? (
                <form
                    onSubmit={handleRequestOtp}
                    className="flex flex-col gap-6"
                >
                    <div className="grid gap-2">
                        <Label htmlFor="phone">Nomor WhatsApp</Label>
                        <Input
                            id="phone"
                            type="tel"
                            name="phone"
                            inputMode="numeric"
                            required
                            autoFocus
                            autoComplete="tel"
                            placeholder="08xxxxxxxxxx"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                        />
                        <InputError message={error} />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={processing}
                        data-test="request-otp-button"
                    >
                        {processing && <Spinner />}
                        Kirim kode OTP
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                        Belum punya warung?{' '}
                        <TextLink href={register()}>Daftar</TextLink>
                    </div>
                </form>
            ) : (
                <form
                    onSubmit={handleVerifyOtp}
                    className="flex flex-col gap-6"
                >
                    <div className="grid gap-2">
                        <Label htmlFor="code">Kode OTP</Label>
                        <p className="text-sm text-muted-foreground">
                            Masukkan 6 digit kode yang kami kirim ke {phone}{' '}
                            via WhatsApp.
                        </p>
                        <InputOTP
                            id="code"
                            name="code"
                            maxLength={OTP_LENGTH}
                            value={code}
                            onChange={setCode}
                            disabled={processing}
                            pattern={REGEXP_ONLY_DIGITS}
                            autoFocus
                            containerClassName="justify-center"
                        >
                            <InputOTPGroup>
                                {Array.from(
                                    { length: OTP_LENGTH },
                                    (_, index) => (
                                        <InputOTPSlot
                                            key={index}
                                            index={index}
                                        />
                                    ),
                                )}
                            </InputOTPGroup>
                        </InputOTP>
                        <InputError message={error} />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={processing || code.length < OTP_LENGTH}
                        data-test="verify-otp-button"
                    >
                        {processing && <Spinner />}
                        Masuk
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                        <button
                            type="button"
                            className="underline-offset-4 hover:underline"
                            onClick={() => {
                                setStep('phone');
                                setCode('');
                                setError(undefined);
                            }}
                        >
                            Ganti nomor
                        </button>
                    </div>
                </form>
            )}
        </>
    );
}

function resolveFieldError(caught: unknown, field: string): string {
    if (caught instanceof ApiError) {
        const fieldError = caught.body?.errors?.[field]?.[0];

        return fieldError ?? caught.message;
    }

    return getRequestErrorMessage(caught);
}

Login.layout = {
    title: 'Masuk ke Amanah',
    description: 'Masukkan nomor WhatsApp untuk menerima kode OTP',
};
