// Components
import { Form, Head, router, usePage } from '@inertiajs/react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { pauseVoiceWorker } from '@/hooks/use-voice-queue';
import { pauseOfflineReconciliationCoordinator } from '@/lib/offline-reconciliation-coordinator';
import { pauseOfflineSalesCoordinator } from '@/lib/offline-sales-coordinator';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export default function VerifyEmail({ status }: { status?: string }) {
    const { auth } = usePage().props;

    const handleLogout = () => {
        if (auth.user.tenant_id !== null) {
            pauseVoiceWorker({
                tenantId: auth.user.tenant_id,
                userId: auth.user.id,
            });
            void pauseOfflineReconciliationCoordinator();
            void pauseOfflineSalesCoordinator();
        }

        router.flushAll();
    };

    return (
        <>
            <Head title="Email verification" />

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    A new verification link has been sent to the email address
                    you provided during registration.
                </div>
            )}

            <Form {...send.form()} className="space-y-6 text-center">
                {({ processing }) => (
                    <>
                        <Button disabled={processing} variant="secondary">
                            {processing && <Spinner />}
                            Resend verification email
                        </Button>

                        <TextLink
                            href={logout()}
                            className="mx-auto block text-sm"
                            onClick={handleLogout}
                        >
                            Log out
                        </TextLink>
                    </>
                )}
            </Form>
        </>
    );
}

VerifyEmail.layout = {
    title: 'Email verification',
    description:
        'Please verify your email address by clicking on the link we just emailed to you.',
};
