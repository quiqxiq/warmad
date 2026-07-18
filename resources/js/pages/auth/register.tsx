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
import { login } from '@/routes';
import {
    requestOtp,
    verify as verifyOtp,
} from '@/routes/api/auth/register';

const OTP_LENGTH = 6;

type VerifyResponse = {
    redirect: string;
};

type Step = 'details' | 'code';

type FieldErrors = Partial<
    Record<'business_name' | 'name' | 'phone' | 'code', string>
>;

export default function Register() {
    const [step, setStep] = useState<Step>('details');
    const [businessName, setBusinessName] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});

    async function handleRequestOtp(event: React.FormEvent) {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            const response = await apiRequest<{ message: string }>(
                requestOtp(),
                { phone },
            );
            toast.success(response.message);
            setStep('code');
        } catch (caught) {
            setErrors(resolveErrors(caught, 'phone'));
        } finally {
            setProcessing(false);
        }
    }

    async function handleVerifyOtp(event: React.FormEvent) {
        event.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            const response = await apiRequest<VerifyResponse>(verifyOtp(), {
                phone,
                code,
                business_name: businessName,
                name,
            });
            // The server established the session cookie; hand off to Inertia.
            router.visit(response.redirect);
        } catch (caught) {
            const resolved = resolveErrors(caught, 'code');
            setErrors(resolved);

            // A phone conflict or expired code means the details step needs
            // attention again; send the owner back to fix it.
            if (resolved.phone || resolved.business_name || resolved.name) {
                setStep('details');
            }

            setCode('');
        } finally {
            setProcessing(false);
        }
    }

    return (
        <>
            <Head title="Daftar" />

            {step === 'details' ? (
                <form
                    onSubmit={handleRequestOtp}
                    className="flex flex-col gap-6"
                >
                    <div className="grid gap-2">
                        <Label htmlFor="business_name">Nama warung</Label>
                        <Input
                            id="business_name"
                            name="business_name"
                            required
                            autoFocus
                            placeholder="Warung Bu Sri"
                            value={businessName}
                            onChange={(event) =>
                                setBusinessName(event.target.value)
                            }
                        />
                        <InputError message={errors.business_name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="name">Nama kamu</Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            autoComplete="name"
                            placeholder="Bu Sri"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="phone">Nomor WhatsApp</Label>
                        <Input
                            id="phone"
                            type="tel"
                            name="phone"
                            inputMode="numeric"
                            required
                            autoComplete="tel"
                            placeholder="08xxxxxxxxxx"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                        />
                        <InputError message={errors.phone} />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={processing}
                        data-test="register-request-otp-button"
                    >
                        {processing && <Spinner />}
                        Kirim kode OTP
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                        Sudah punya akun?{' '}
                        <TextLink href={login()}>Masuk</TextLink>
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
                        <InputError message={errors.code} />
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        disabled={processing || code.length < OTP_LENGTH}
                        data-test="register-verify-otp-button"
                    >
                        {processing && <Spinner />}
                        Buat warung
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                        <button
                            type="button"
                            className="underline-offset-4 hover:underline"
                            onClick={() => {
                                setStep('details');
                                setCode('');
                                setErrors({});
                            }}
                        >
                            Ubah data
                        </button>
                    </div>
                </form>
            )}
        </>
    );
}

function resolveErrors(caught: unknown, fallbackField: string): FieldErrors {
    if (caught instanceof ApiError) {
        const fieldErrors = caught.body?.errors;

        if (fieldErrors) {
            return Object.fromEntries(
                Object.entries(fieldErrors).map(([field, messages]) => [
                    field,
                    messages[0],
                ]),
            );
        }

        return { [fallbackField]: caught.message };
    }

    return { [fallbackField]: getRequestErrorMessage(caught) };
}

Register.layout = {
    title: 'Buat warung baru',
    description: 'Daftar dengan nomor WhatsApp untuk mulai berjualan',
};
