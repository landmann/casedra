"use client";

import { Button, cn, Input, Textarea } from "@casedra/ui";
import {
	ArrowRight,
	Banknote,
	Building2,
	CheckCircle2,
	ClipboardList,
	FileSearch,
	Globe2,
	Home,
	Mail,
	MessageSquareText,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import type { BuyerPageContent } from "./buyer-content";
import { intentClusters } from "./buyer-content";
import { capturePosthogEvent } from "@/lib/posthog";

type SubmitStatus = "idle" | "loading" | "success" | "error";

const icons = {
	banknote: Banknote,
	building: Building2,
	file: FileSearch,
	globe: Globe2,
	home: Home,
} as const;

const sourceFromUtm = (source?: string | null) => {
	const normalized = source?.toLowerCase();
	if (!normalized) {
		return "seo";
	}
	if (normalized.includes("google")) {
		return "google_search";
	}
	if (normalized.includes("linkedin")) {
		return "linkedin";
	}
	if (normalized.includes("meta") || normalized.includes("instagram")) {
		return "meta";
	}
	if (normalized.includes("partner")) {
		return "partner";
	}
	if (normalized.includes("community")) {
		return "community";
	}
	if (normalized.includes("referral")) {
		return "referral";
	}
	return "seo";
};

const agencySlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

const normalizeAgencySlug = (value?: string | null) => {
	const normalized = value?.trim().toLowerCase();
	if (!normalized || !agencySlugPattern.test(normalized)) {
		return undefined;
	}
	return normalized;
};

const getUtmPayload = () => {
	if (typeof window === "undefined") {
		return {
			formPath: "/buyers",
			landingPath: "/buyers",
			utm: {},
			source: "seo",
			campaign: undefined,
			agencySlug: undefined,
		};
	}
	const params = new URLSearchParams(window.location.search);
	const utm = {
		utm_source: params.get("utm_source") ?? undefined,
		utm_medium: params.get("utm_medium") ?? undefined,
		utm_campaign: params.get("utm_campaign") ?? undefined,
		utm_term: params.get("utm_term") ?? undefined,
		utm_content: params.get("utm_content") ?? undefined,
	};

	return {
		formPath: window.location.pathname,
		landingPath: `${window.location.pathname}${window.location.search}`,
		utm,
		source: sourceFromUtm(utm.utm_source),
		campaign: utm.utm_campaign,
		agencySlug: normalizeAgencySlug(
			params.get("agency") ?? params.get("agency_slug") ?? params.get("ref"),
		),
	};
};

const copy = {
	es: {
		language: "Idioma",
		signupName: "Nombre",
		email: "Email",
		join: "Unirme",
		sending: "Enviando",
		successSignup:
			"Estás dentro. Te enviaremos el próximo Informe del Comprador.",
		successQuestion: "Recibido. Lo veremos en la bandeja y responderemos con el primer bloque de comprobaciones.",
		error: "No se pudo enviar. Inténtalo otra vez.",
		privacy:
			"Acepto recibir comunicaciones de Casedra y que Casedra guarde prueba de este consentimiento.",
		questionPrivacy:
			"Acepto que Casedra procese esta consulta, mis datos de contacto y la prueba de consentimiento para responder.",
		fullName: "Nombre completo",
		phone: "Teléfono o WhatsApp",
		propertyUrl: "URL del anuncio",
		budget: "Presupuesto",
		timeline: "Horizonte de compra",
		question: "Qué quieres saber",
		contactPath: "Contacto preferido",
		briefOptIn: "También quiero recibir el Informe del Comprador",
		ask: "Enviar consulta",
		emailChoice: "Email",
		whatsappChoice: "WhatsApp",
		phoneChoice: "Teléfono",
		noneChoice: "Sin preferencia",
		requiredProof: "Consentimiento claro, fuentes trazables y baja gratuita.",
		back: "Casedra",
	},
} as const;

const contactOptions = [
	["email", "emailChoice"],
	["whatsapp", "whatsappChoice"],
	["phone", "phoneChoice"],
	["none", "noneChoice"],
] as const;

export function BuyerPage({ page }: { page: BuyerPageContent }) {
	const language = "es";
	const [utmPayload, setUtmPayload] = useState(getUtmPayload);
	const [signupStatus, setSignupStatus] = useState<SubmitStatus>("idle");
	const [questionStatus, setQuestionStatus] = useState<SubmitStatus>("idle");
	const [contactPreference, setContactPreference] = useState<
		"email" | "whatsapp" | "phone" | "none"
	>("email");
	const [subscribeToBrief, setSubscribeToBrief] = useState(true);
	const text = page.copy.es;
	const ui = copy.es;
	const Icon = icons[page.icon];

	useEffect(() => {
		setUtmPayload(getUtmPayload());
	}, []);

	const basePayload = useMemo(
		() => ({
			language,
			market: "madrid",
			audience: page.key === "investors" ? "investors" : "buyers",
			source: utmPayload.source,
			campaign: utmPayload.campaign,
			signal: page.signal,
			agencySlug: utmPayload.agencySlug,
			formPath: utmPayload.formPath,
			landingPath: utmPayload.landingPath,
			utm: utmPayload.utm,
			consentAccepted: true,
			privacyAccepted: true,
		}),
		[language, page.key, page.signal, utmPayload],
	);

	const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSignupStatus("loading");
		const form = new FormData(event.currentTarget);
		const payload = {
			...basePayload,
			email: String(form.get("email") ?? ""),
			fullName: String(form.get("fullName") ?? ""),
			contactPreference: "email",
			honeypot: String(form.get("company") ?? ""),
		};
		const response = await fetch("/api/buyers/subscribe", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			setSignupStatus("success");
			capturePosthogEvent("buyer_brief_signup", {
				path: page.path,
				language,
				signal: page.signal,
				campaign: utmPayload.campaign,
			});
			event.currentTarget.reset();
			return;
		}
		setSignupStatus("error");
	};

	const handleQuestion = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setQuestionStatus("loading");
		const form = new FormData(event.currentTarget);
		const payload = {
			...basePayload,
			fullName: String(form.get("fullName") ?? ""),
			email: String(form.get("email") ?? ""),
			phone: String(form.get("phone") ?? ""),
			propertyUrl: String(form.get("propertyUrl") ?? ""),
			question: String(form.get("question") ?? ""),
			budgetBand: String(form.get("budgetBand") ?? ""),
			buyingTimeline: String(form.get("buyingTimeline") ?? ""),
			contactPreference,
			subscribeToBrief,
			honeypot: String(form.get("company") ?? ""),
		};
		const response = await fetch("/api/buyers/question", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});

		if (response.ok) {
			setQuestionStatus("success");
			capturePosthogEvent("buyer_property_question", {
				path: page.path,
				language,
				signal: page.signal,
				contactPreference,
				subscribeToBrief,
				campaign: utmPayload.campaign,
			});
			event.currentTarget.reset();
			return;
		}
		setQuestionStatus("error");
	};

	return (
		<main className="min-h-screen bg-background text-foreground">
			<header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
				<Link href="/" className="inline-flex items-center gap-3">
					<span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background font-serif text-xl shadow-sm">
						C
					</span>
					<span className="text-xs font-medium uppercase tracking-[0.26em] text-muted-foreground">
						{ui.back}
					</span>
				</Link>
			</header>

			<section className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:pb-20">
				<div className="flex flex-col justify-between gap-8">
					<div>
						<div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
							<Icon className="h-4 w-4 text-primary" aria-hidden="true" />
							{text.eyebrow}
						</div>
						<h1 className="mt-6 max-w-3xl text-balance font-serif text-[3.4rem] font-normal leading-[0.94] sm:text-[5rem]">
							{text.title}
						</h1>
						<p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
							{text.intro}
						</p>
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						{text.points.map((point) => (
							<div key={point} className="border-t border-border pt-4">
								<CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
								<p className="mt-3 text-sm leading-6 text-muted-foreground">{point}</p>
							</div>
						))}
					</div>
				</div>

				<div className="grid gap-5">
					<form
						onSubmit={handleSignup}
						className="border border-border bg-secondary/45 p-5 shadow-[0_20px_70px_rgba(31,26,20,0.08)] sm:p-6"
					>
						<div className="flex items-start gap-3">
							<Mail className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
							<div>
								<h2 className="font-serif text-3xl font-normal leading-tight">
									{text.signupLead}
								</h2>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									{text.brief}
								</p>
							</div>
						</div>
						<input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" />
						<div className="mt-5 grid gap-3 sm:grid-cols-[0.8fr_1fr_auto]">
							<Input name="fullName" placeholder={ui.signupName} className="min-h-12 rounded-none bg-background/70" />
							<Input name="email" type="email" required placeholder={ui.email} className="min-h-12 rounded-none bg-background/70" />
							<Button disabled={signupStatus === "loading"} className="min-h-12 rounded-none px-6">
								{signupStatus === "loading" ? ui.sending : ui.join}
								<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
							</Button>
						</div>
						<label className="mt-4 flex gap-3 text-xs leading-5 text-muted-foreground">
							<input type="checkbox" required defaultChecked className="mt-1 accent-[#9C6137]" />
							<span>{ui.privacy}</span>
						</label>
						{signupStatus === "success" ? (
							<p className="mt-4 text-sm text-primary">{ui.successSignup}</p>
						) : null}
						{signupStatus === "error" ? (
							<p className="mt-4 text-sm text-destructive">{ui.error}</p>
						) : null}
					</form>

					<form
						onSubmit={handleQuestion}
						className="border border-border bg-background/95 p-5 shadow-[0_20px_70px_rgba(31,26,20,0.06)] sm:p-6"
					>
						<div className="flex items-start gap-3">
							<MessageSquareText className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
							<div>
								<h2 className="font-serif text-3xl font-normal leading-tight">
									{text.propertyLead}
								</h2>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									{text.questionPrompt}
								</p>
							</div>
						</div>
						<input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" />
						<div className="mt-5 grid gap-3 sm:grid-cols-2">
							<Input name="fullName" required placeholder={ui.fullName} className="min-h-12 rounded-none bg-secondary/45" />
							<Input name="email" type="email" placeholder={ui.email} className="min-h-12 rounded-none bg-secondary/45" />
							<Input name="phone" placeholder={ui.phone} className="min-h-12 rounded-none bg-secondary/45" />
							<Input name="propertyUrl" type="url" required placeholder={ui.propertyUrl} className="min-h-12 rounded-none bg-secondary/45" />
							<Input name="budgetBand" required placeholder={ui.budget} className="min-h-12 rounded-none bg-secondary/45" />
							<Input name="buyingTimeline" required placeholder={ui.timeline} className="min-h-12 rounded-none bg-secondary/45" />
						</div>
						<Textarea
							name="question"
							required
							placeholder={ui.question}
							className="mt-3 min-h-32 rounded-none bg-secondary/45"
						/>
						<div className="mt-4">
							<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
								{ui.contactPath}
							</p>
							<div className="mt-2 flex flex-wrap gap-2">
								{contactOptions.map(([value, label]) => (
									<button
										key={value}
										type="button"
										aria-pressed={contactPreference === value}
										onClick={() => setContactPreference(value)}
										className={cn(
											"min-h-10 border border-border px-4 text-sm transition-colors",
											contactPreference === value
												? "bg-primary text-primary-foreground"
												: "bg-secondary/45 text-muted-foreground hover:text-foreground",
										)}
									>
										{ui[label]}
									</button>
								))}
							</div>
						</div>
						<label className="mt-4 flex gap-3 text-xs leading-5 text-muted-foreground">
							<input
								type="checkbox"
								checked={subscribeToBrief}
								onChange={(event) => setSubscribeToBrief(event.target.checked)}
								className="mt-1 accent-[#9C6137]"
							/>
							<span>{ui.briefOptIn}</span>
						</label>
						<label className="mt-3 flex gap-3 text-xs leading-5 text-muted-foreground">
							<input type="checkbox" required defaultChecked className="mt-1 accent-[#9C6137]" />
							<span>{ui.questionPrivacy}</span>
						</label>
						<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
								<ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
								{ui.requiredProof}
							</p>
							<Button disabled={questionStatus === "loading"} className="min-h-12 rounded-none px-6">
								{questionStatus === "loading" ? ui.sending : ui.ask}
								<ClipboardList className="ml-2 h-4 w-4" aria-hidden="true" />
							</Button>
						</div>
						{questionStatus === "success" ? (
							<p className="mt-4 text-sm text-primary">{ui.successQuestion}</p>
						) : null}
						{questionStatus === "error" ? (
							<p className="mt-4 text-sm text-destructive">{ui.error}</p>
						) : null}
					</form>
				</div>
			</section>

			<section className="border-t border-border bg-secondary/45">
				<div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[0.6fr_1.4fr] lg:px-12">
					<p className="font-serif text-3xl font-normal leading-tight">
						{text.eyebrow}
					</p>
					<div className="flex flex-wrap gap-2">
						{intentClusters.map((cluster) => (
							<span key={cluster} className="border border-border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
								{cluster}
							</span>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
