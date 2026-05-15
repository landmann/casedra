import { SignIn } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { ArrowLeft, Building2 } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isAllowedAppUser } from "@/lib/app-access";

type SignInPageProps = {
	searchParams?: Promise<{
		redirect_url?: string | string[];
		redirectUrl?: string | string[];
	}>;
};

export const metadata: Metadata = {
	title: "Iniciar sesión | Casedra",
	description:
		"Accede al espacio de trabajo de Casedra para gestionar contactos en directo, controlar el reparto y generar pruebas semanales.",
};

const getFirstSearchParam = (value?: string | string[]) =>
	Array.isArray(value) ? value[0] : value;

const getSafePostAuthRedirect = (value?: string | string[]) => {
	const rawValue = getFirstSearchParam(value)?.trim();

	if (!rawValue) {
		return null;
	}

	const path = rawValue.startsWith("/")
		? rawValue
		: (() => {
				try {
					const url = new URL(rawValue);
					return `${url.pathname}${url.search}${url.hash}`;
				} catch {
					return null;
				}
			})();

	if (!path || path.startsWith("//")) {
		return null;
	}

	return path === "/app" ||
		path.startsWith("/app/") ||
		path === "/masterplan" ||
		path.startsWith("/masterplan/")
		? path
		: null;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
	const resolvedSearchParams = searchParams ? await searchParams : undefined;
	const postAuthRedirect =
		getSafePostAuthRedirect(
			resolvedSearchParams?.redirect_url ?? resolvedSearchParams?.redirectUrl,
		) ?? "/app";
	const user = await currentUser();

	if (user) {
		redirect(isAllowedAppUser(user) ? postAuthRedirect : "/access-restricted");
	}

	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="relative isolate overflow-hidden">
				<div className="pointer-events-none absolute inset-0">
					<div className="absolute left-[-8rem] top-[-6rem] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(156,97,55,0.22),transparent_60%)] blur-3xl" />
					<div className="absolute right-[-5rem] top-[-5rem] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(232,223,204,0.9),transparent_64%)] blur-3xl" />
					<div className="absolute inset-0 bg-[linear-gradient(rgba(31,26,20,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(31,26,20,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.18),transparent_72%)]" />
				</div>

				<div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-12">
					<header className="flex items-center justify-between gap-4">
						<Link
							href="/"
							className="inline-flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							<span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/85 font-serif text-lg text-foreground shadow-sm">
								C
							</span>
							<span className="inline-flex items-center gap-2">
								<ArrowLeft className="h-4 w-4" aria-hidden="true" />
								Volver al sitio
							</span>
						</Link>
						<div className="hidden items-center gap-2 rounded-full border border-border bg-background/85 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground shadow-sm sm:inline-flex">
							<Building2
								className="h-3.5 w-3.5 text-primary"
								aria-hidden="true"
							/>
							Acceso al espacio de Casedra
						</div>
					</header>

					<section className="flex flex-1 flex-col justify-center gap-8 py-8 lg:gap-10 lg:py-12">
						<div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-10 lg:gap-x-16">
							<div className="min-w-[min(100%,22rem)] flex-1">
								<h1 className="max-w-4xl text-balance font-serif text-[3rem] font-normal leading-[0.98] text-foreground sm:text-[3.45rem] lg:text-[4.4rem] xl:text-[5.1rem]">
									Inicia sesión para controlar cada contacto.
								</h1>
								<p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
									Casedra reúne primera respuesta, reparto, cobertura y
									conversaciones con propietarios en una sola bandeja.
								</p>
								<p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
									El acceso está limitado a cuentas aprobadas por ahora.
								</p>
							</div>

							<div className="relative w-full min-w-[min(100%,23rem)] flex-[0_1_30rem]">
								<div className="absolute -inset-4 rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(156,97,55,0.18),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(111,94,74,0.14),transparent_34%)] blur-2xl sm:-inset-6" />
								<div className="casedra-clerk-auth relative">
									<SignIn
										path="/sign-in"
										routing="path"
										withSignUp
										forceRedirectUrl={postAuthRedirect}
										fallbackRedirectUrl={postAuthRedirect}
										signUpForceRedirectUrl={postAuthRedirect}
										signUpFallbackRedirectUrl={postAuthRedirect}
									/>
								</div>
							</div>
						</div>

						<figure className="overflow-hidden rounded-[1.5rem] border border-border bg-secondary shadow-[0_24px_80px_rgba(31,26,20,0.14)]">
							<Image
								src="/images/marketing/casedra-signin-command.webp"
								alt="Mesa editorial con dossier inmobiliario, mapa, mensajes y panel operativo de Casedra"
								width={1672}
								height={941}
								priority
								sizes="(min-width: 1280px) 1184px, calc(100vw - 40px)"
								className="aspect-[16/8] w-full object-cover sm:aspect-[16/6] lg:aspect-[16/5]"
							/>
						</figure>
					</section>
				</div>
			</div>
		</main>
	);
}
