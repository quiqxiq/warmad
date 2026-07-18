import { Head, router, useForm } from '@inertiajs/react';
import { Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import {
    index as penjagaIndex,
    store as penjagaStore,
    destroy as penjagaDestroy,
} from '@/actions/App/Http/Controllers/PenjagaController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

type PenjagaOutlet = {
    id: number;
    name: string;
};

type Penjaga = {
    id: number;
    name: string;
    phone: string;
    phone_verified_at: string | null;
    created_at: string;
    outlets: PenjagaOutlet[];
};

type PenjagaIndexProps = {
    penjaga: Penjaga[];
    outlets: PenjagaOutlet[];
};

export default function PenjagaIndex({ penjaga, outlets }: PenjagaIndexProps) {
    const [removing, setRemoving] = useState<number | null>(null);

    const form = useForm({
        name: '',
        phone: '',
        outlet_id: outlets[0]?.id.toString() ?? '',
    });

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        form.submit(penjagaStore(), {
            preserveScroll: true,
            onSuccess: () => form.reset('name', 'phone'),
        });
    }

    function handleDestroy(target: Penjaga) {
        if (
            !window.confirm(
                `Hapus penjaga ${target.name}? Mereka tidak akan bisa masuk lagi.`,
            )
        ) {
            return;
        }

        setRemoving(target.id);
        router.delete(penjagaDestroy(target.id), {
            preserveScroll: true,
            onFinish: () => setRemoving(null),
        });
    }

    return (
        <>
            <Head title="Penjaga" />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4">
                <div>
                    <h1 className="text-xl font-semibold">Penjaga</h1>
                    <p className="text-sm text-muted-foreground">
                        Tambahkan kasir untuk warung kamu. Mereka masuk dengan
                        nomor WhatsApp dan kode OTP.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="size-5" />
                            Tambah penjaga
                        </CardTitle>
                        <CardDescription>
                            {outlets.length === 0
                                ? 'Buat outlet aktif terlebih dahulu sebelum menambah penjaga.'
                                : 'Penjaga akan ditautkan ke outlet yang kamu pilih.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={handleSubmit}
                            className="grid gap-4 md:grid-cols-3"
                        >
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nama</Label>
                                <Input
                                    id="name"
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                    required
                                    placeholder="Nama penjaga"
                                    disabled={outlets.length === 0}
                                />
                                <InputError message={form.errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="phone">Nomor WhatsApp</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    inputMode="numeric"
                                    value={form.data.phone}
                                    onChange={(event) =>
                                        form.setData(
                                            'phone',
                                            event.target.value,
                                        )
                                    }
                                    required
                                    placeholder="08xxxxxxxxxx"
                                    disabled={outlets.length === 0}
                                />
                                <InputError message={form.errors.phone} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="outlet_id">Outlet</Label>
                                <Select
                                    value={form.data.outlet_id}
                                    onValueChange={(value) =>
                                        form.setData('outlet_id', value)
                                    }
                                    disabled={outlets.length === 0}
                                >
                                    <SelectTrigger id="outlet_id">
                                        <SelectValue placeholder="Pilih outlet" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {outlets.map((outlet) => (
                                            <SelectItem
                                                key={outlet.id}
                                                value={outlet.id.toString()}
                                            >
                                                {outlet.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={form.errors.outlet_id} />
                            </div>

                            <div className="md:col-span-3">
                                <Button
                                    type="submit"
                                    disabled={
                                        form.processing || outlets.length === 0
                                    }
                                    data-test="add-penjaga-button"
                                >
                                    {form.processing && <Spinner />}
                                    Tambah penjaga
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {penjaga.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                        <Users className="size-8" />
                        <p>Belum ada penjaga. Tambahkan yang pertama di atas.</p>
                    </div>
                ) : (
                    <ul className="grid gap-3">
                        {penjaga.map((person) => (
                            <li
                                key={person.id}
                                className="flex items-center justify-between gap-4 rounded-xl border border-sidebar-border/70 p-4 dark:border-sidebar-border"
                            >
                                <div>
                                    <p className="font-medium">
                                        {person.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {person.phone}
                                        {person.phone_verified_at === null &&
                                            ' · belum pernah masuk'}
                                    </p>
                                    {person.outlets.length > 0 && (
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {person.outlets
                                                .map((outlet) => outlet.name)
                                                .join(', ')}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Hapus ${person.name}`}
                                    disabled={removing === person.id}
                                    onClick={() => handleDestroy(person)}
                                >
                                    {removing === person.id ? (
                                        <Spinner />
                                    ) : (
                                        <Trash2 className="size-4 text-destructive" />
                                    )}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

PenjagaIndex.layout = {
    breadcrumbs: [
        {
            title: 'Penjaga',
            href: penjagaIndex(),
        },
    ],
};
