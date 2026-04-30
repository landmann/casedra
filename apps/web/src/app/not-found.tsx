import { Button } from "@casedra/ui";
import { ArrowLeft, Home } from "lucide-react";
import Link from "next/link";

const traceItems = [
	"Dirección no registrada",
	"Portal sin coincidencia",
	"Volver a la oficina",
] as const;

export default function NotFound() {
	return (
		<main className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
			<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(31,26,20,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(31,26,20,0.045)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.18),transparent_78%)]" />
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(232,223,204,0.42),transparent)]" />

			<header className="absolute left-5 top-5 z-10 sm:left-8 sm:top-6 lg:left-12">
				<Link
					href="/"
					className="inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground"
				>
					<span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 font-serif text-xl text-foreground shadow-sm">
						C
					</span>
					Casedra
				</Link>
			</header>

			<section className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
				<div className="max-w-3xl">
					<h1 className="max-w-2xl font-serif text-[3.5rem] font-normal leading-[0.94] text-foreground sm:text-[5.5rem] lg:text-[6.35rem]">
						Esta fachada no tiene puerta.
					</h1>
					<p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
						La página que buscas no existe o se ha movido. Hemos dejado la
						dirección apuntada, pero aquí no hay expediente que abrir.
					</p>

					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Button asChild size="lg" className="rounded-full px-7">
							<Link href="/app" className="inline-flex items-center gap-2">
								<Home className="h-4 w-4" aria-hidden="true" />
								Ir al espacio de trabajo
							</Link>
						</Button>
						<Button
							asChild
							size="lg"
							variant="outline"
							className="rounded-full px-7"
						>
							<Link href="/" className="inline-flex items-center gap-2">
								<ArrowLeft className="h-4 w-4" aria-hidden="true" />
								Volver al sitio
							</Link>
						</Button>
					</div>

					<div className="mt-10 grid gap-2 border-l border-border pl-4 text-sm text-muted-foreground sm:grid-cols-3 sm:border-l-0 sm:border-t sm:pl-0 sm:pt-4">
						{traceItems.map((item) => (
							<div key={item} className="flex items-center gap-2">
								<span className="h-1.5 w-1.5 rounded-full bg-primary" />
								{item}
							</div>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
