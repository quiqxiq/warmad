import { Banknote, LoaderCircle, Play } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupiah, parseMoney } from '@/lib/money';
import type { Outlet } from '@/types';

type StartShiftFormProps = {
    outlet: Outlet;
    isSubmitting: boolean;
    onSubmit: (openingCash: number) => void | Promise<void>;
};

export function StartShiftForm({
    outlet,
    isSubmitting,
    onSubmit,
}: StartShiftFormProps) {
    const [openingCash, setOpeningCash] = useState('0');
    const numericOpeningCash = parseMoney(openingCash);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void onSubmit(numericOpeningCash);
    };

    return (
        <main className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-xl items-center p-4">
            <section className="w-full overflow-hidden rounded-3xl border bg-card shadow-xl shadow-primary/5">
                <div className="bg-primary p-6 text-primary-foreground sm:p-8">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15">
                        <Play className="size-7 fill-current" />
                    </span>
                    <p className="mt-5 text-sm font-semibold tracking-[0.16em] text-white/70 uppercase">
                        {outlet.name}
                    </p>
                    <h1 className="mt-1 text-3xl font-bold">
                        Mulai shift kasir
                    </h1>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
                        Catat uang kas awal sebelum menerima transaksi hari ini.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-5 p-6 sm:p-8">
                    <div className="grid gap-2">
                        <Label htmlFor="opening-cash">Kas awal</Label>
                        <div className="relative">
                            <Banknote className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="opening-cash"
                                inputMode="numeric"
                                value={openingCash}
                                onChange={(event) =>
                                    setOpeningCash(
                                        String(parseMoney(event.target.value)),
                                    )
                                }
                                className="min-h-14 rounded-xl pl-12 text-lg font-semibold"
                                autoFocus
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {formatRupiah(numericOpeningCash)}
                        </p>
                    </div>

                    <Button
                        type="submit"
                        size="lg"
                        className="min-h-14 rounded-xl text-base"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <Play className="fill-current" />
                        )}
                        {isSubmitting ? 'Membuka shift…' : 'Buka shift'}
                    </Button>
                </form>
            </section>
        </main>
    );
}
