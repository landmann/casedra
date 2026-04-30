import type {
	LocalizaPropertyDossier,
	ResolveIdealistaLocationResult,
} from "@casedra/types";
import { Button, cn } from "@casedra/ui";
import {
	AlertTriangle,
	ArrowLeft,
	Copy,
	Download,
	Euro,
	Heart,
	ImageIcon,
} from "lucide-react";
import Link from "next/link";

type LocalizaPropertyReportProps = {
	dossier: LocalizaPropertyDossier;
	result?: ResolveIdealistaLocationResult;
	backHref?: string;
	showNavigation?: boolean;
	className?: string;
};

const formatDate = (value?: string) => {
	if (!value) {
		return "Fecha no disponible";
	}

	return new Intl.DateTimeFormat("es-ES", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date(value));
};

const formatEuro = (value?: number) =>
	value === undefined
		? "Precio no disponible"
		: `${new Intl.NumberFormat("es-ES", {
				maximumFractionDigits: 0,
			}).format(value)} €`;

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const buildReportDownloadHref = (dossier: LocalizaPropertyDossier) => {
	const identity = dossier.officialIdentity;
	const snapshot = dossier.listingSnapshot;
	const historyRows = dossier.publicHistory
		.map(
			(row) =>
				`<li>${escapeHtml(formatDate(row.observedAt))} - ${escapeHtml(
					formatEuro(row.askingPrice),
				)} - ${escapeHtml(row.portal)}${
					row.agencyName ? ` - ${escapeHtml(row.agencyName)}` : ""
				}</li>`,
		)
		.join("");
	const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe Localiza</title><body style="font-family:Arial,sans-serif;color:#1F1A14;background:#FFFBF2;padding:32px"><h1>${escapeHtml(
		snapshot.title ?? "Informe de propiedad",
	)}</h1><p><strong>${escapeHtml(formatEuro(snapshot.askingPrice))}</strong></p><p>Dirección propuesta: ${escapeHtml(
		identity.proposedAddressLabel ?? "No disponible",
	)}</p><p>Referencia catastral: ${escapeHtml(
		identity.unitRef20 ?? identity.parcelRef14 ?? "No disponible",
	)}</p><p>Fuente: ${escapeHtml(identity.officialSource)}</p><h2>Histórico público</h2><ul>${historyRows}</ul></body></html>`;

	return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

const buildDownloadName = (dossier: LocalizaPropertyDossier) => {
	const source = dossier.listingSnapshot.sourceUrl
		.replace(/^https?:\/\/(www\.)?/i, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/(^-|-$)/g, "")
		.slice(0, 48);

	return `informe-localiza-${source || "propiedad"}.html`;
};

const getFactLine = (dossier: LocalizaPropertyDossier) => {
	const snapshot = dossier.listingSnapshot;
	const facts = [
		snapshot.areaM2 ? `${snapshot.areaM2} m²` : undefined,
		snapshot.bedrooms !== undefined ? `${snapshot.bedrooms} hab.` : undefined,
		snapshot.floorText,
		snapshot.isExterior ? "exterior" : undefined,
		snapshot.hasElevator ? "ascensor" : undefined,
	];

	return facts.filter(Boolean).join(", ");
};

const getDurationLabel = (days: number) =>
	days === 1 ? "1 día publicado" : `${days} días publicados`;

const getObservationLabel = (count: number) =>
	count === 1 ? "1 observación" : `${count} observaciones`;

const getHistoryPartyLabel = (
	row: LocalizaPropertyDossier["publicHistory"][number],
) => row.agencyName ?? row.advertiserName ?? "Anuncio público";

const getDurationKindLabel = (
	kind: LocalizaPropertyDossier["publicationDurations"][number]["kind"],
) =>
	({
		advertiser: "Anunciante",
		agency: "Agencia",
		portal: "Portal",
	})[kind];

const formatSourceHost = (sourceUrl?: string) =>
	sourceUrl
		? sourceUrl.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")
		: undefined;

const sortHistory = (history: LocalizaPropertyDossier["publicHistory"]) =>
	[...history].sort(
		(left, right) =>
			new Date(right.observedAt).getTime() -
			new Date(left.observedAt).getTime(),
	);

export function LocalizaPropertyReport({
	dossier,
	result,
	backHref = "/app/onboarding?step=listings",
	showNavigation = true,
	className,
}: LocalizaPropertyReportProps) {
	const snapshot = dossier.listingSnapshot;
	const identity = dossier.officialIdentity;
	const leadImage = snapshot.leadImageUrl ?? dossier.imageGallery[0]?.imageUrl;
	const history = sortHistory(dossier.publicHistory);
	const maxDuration = Math.max(
		1,
		...dossier.publicationDurations.map((entry) => entry.daysPublished),
	);
	const factLine = getFactLine(dossier);
	const reportHref =
		dossier.actions.reportDownloadUrl ?? buildReportDownloadHref(dossier);
	const downloadName = dossier.actions.reportDownloadUrl
		? undefined
		: buildDownloadName(dossier);
	const valuationHref = dossier.actions.valuationUrl ?? "/app/studio";
	const cadastralReference = identity.unitRef20 ?? identity.parcelRef14;
	const duplicateCount = dossier.duplicateGroup.count;

	return (
		<section
			className={cn(
				"localiza-property-report rounded-[1.75rem] bg-[#FFFBF2] p-3 text-[#1F1A14] shadow-[0_28px_90px_rgba(31,26,20,0.1),inset_0_0_0_1px_rgba(232,223,204,0.95)]",
				className,
			)}
			aria-label="Informe de propiedad Localiza"
		>
			{showNavigation ? (
				<div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
					<Button
						asChild
						variant="ghost"
						className="min-h-10 rounded-full px-3 text-[#6F5E4A] transition-[background-color,color,transform] duration-200 hover:bg-[#FFF8EA] hover:text-[#9C6137] active:scale-[0.96]"
					>
						<Link href={backHref}>
							<ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
							Volver al listado
						</Link>
					</Button>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							asChild
							className="min-h-10 rounded-full bg-[#9C6137] px-4 text-[#FFFBF2] shadow-[0_10px_24px_rgba(156,97,55,0.2)] transition-[background-color,color,box-shadow,transform] duration-200 hover:bg-[#87522D] active:scale-[0.96]"
						>
							<a href={reportHref} download={downloadName}>
								<Download className="mr-2 h-4 w-4" aria-hidden="true" />
								Descargar informe de propiedad
							</a>
						</Button>
						<Button
							asChild
							variant="outline"
							className="min-h-10 rounded-full border-0 bg-[#FFF8EA] px-4 text-[#9C6137] shadow-[inset_0_0_0_1px_rgba(156,97,55,0.22)] transition-[background-color,color,box-shadow,transform] duration-200 hover:bg-[#FFFBF2] hover:text-[#87522D] hover:shadow-[inset_0_0_0_1px_rgba(156,97,55,0.34)] active:scale-[0.96]"
						>
							<Link href={valuationHref}>
								<Euro className="mr-2 h-4 w-4" aria-hidden="true" />
								Valoraciones
							</Link>
						</Button>
					</div>
				</div>
			) : null}

			<div className="grid gap-3 rounded-[1.35rem] bg-[#FFF8EA] p-3 shadow-[0_14px_42px_rgba(31,26,20,0.07),inset_0_0_0_1px_rgba(232,223,204,0.95)] lg:grid-cols-[330px_minmax(0,1fr)_112px]">
				<div className="relative min-h-[220px] overflow-hidden rounded-[0.95rem] bg-[#E8DFCC] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]">
					{leadImage ? (
						<img
							src={leadImage}
							alt={snapshot.title ?? "Imagen del inmueble"}
							className="h-full min-h-[220px] w-full object-cover outline outline-1 outline-black/10"
						/>
					) : (
						<div className="flex h-full min-h-[220px] items-center justify-center text-[#6F5E4A]">
							<ImageIcon className="h-8 w-8" aria-hidden="true" />
						</div>
					)}
				</div>

				<div className="relative min-h-[220px] px-2 py-1 sm:px-3">
					<span className="inline-flex min-h-8 items-center rounded-full bg-[#FFFBF2] px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9C6137] shadow-[inset_0_0_0_1px_rgba(156,97,55,0.18)]">
						Localiza
					</span>
					<h1 className="mt-3 font-serif text-3xl font-normal leading-tight text-[#1F1A14] text-balance">
						{snapshot.title ?? "Inmueble de Idealista"}
					</h1>
					<p className="mt-3 text-base text-[#1F1A14]">
						<span className="font-semibold tabular-nums">
							{formatEuro(snapshot.askingPrice)}
						</span>
						{snapshot.priceIncludesParking ? (
							<span>, Garaje incluido</span>
						) : null}
					</p>
					{factLine ? (
						<p className="mt-2 text-sm leading-6 text-[#6F5E4A] text-pretty">
							{factLine}
						</p>
					) : null}
					<div className="mt-4 grid gap-2 rounded-[1rem] bg-[#FFFBF2]/82 p-3 text-sm shadow-[inset_0_0_0_1px_rgba(232,223,204,0.86)]">
						<p className="leading-6 text-[#6F5E4A]">
							Dirección propuesta{" "}
							<span className="font-medium text-[#1F1A14]">
								{identity.proposedAddressLabel ?? "Pendiente de confirmar"}
							</span>
						</p>
						<p className="leading-6 text-[#6F5E4A]">
							Referencia catastral{" "}
							<span className="font-medium text-[#1F1A14]">
								{cadastralReference ?? "No disponible"}
							</span>
						</p>
						<p className="leading-6 text-[#6F5E4A]">
							Fuente{" "}
							<span className="font-medium italic text-[#1F1A14]">
								{identity.officialSource}
							</span>
						</p>
					</div>
					{result ? (
						<p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[#6F5E4A]">
							{result.status.replace(/_/g, " ")} · Seguridad{" "}
							<span className="tabular-nums">
								{Math.round(result.confidenceScore * 100)}%
							</span>
						</p>
					) : null}
				</div>

				<div className="flex items-start justify-start lg:justify-end">
					<div className="flex w-full flex-row items-center justify-between gap-3 rounded-[1rem] bg-[#FFFBF2] p-3 shadow-[0_8px_22px_rgba(31,26,20,0.05),inset_0_0_0_1px_rgba(232,223,204,0.92)] lg:w-auto lg:flex-col lg:items-end">
						<span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6F5E4A]">
							Portal
						</span>
						<span className="flex min-h-12 min-w-12 items-center justify-center rounded-[0.8rem] bg-[#9C6137] px-3 font-mono text-2xl font-bold leading-none text-[#FFFBF2] shadow-[0_9px_20px_rgba(156,97,55,0.2)]">
							id
						</span>
						<span className="text-xs font-medium text-[#1F1A14]">
							Idealista
						</span>
					</div>
				</div>
			</div>

			<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] bg-[#FFF8EA] px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(232,223,204,0.9)]">
				<span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FFFBF2]/70 px-3 text-[#6F5E4A] shadow-[inset_0_0_0_1px_rgba(232,223,204,0.72)]">
					<AlertTriangle className="h-4 w-4" aria-hidden="true" />
					Notificar una incidencia
				</span>
				<div className="flex flex-wrap items-center gap-2 text-[#9C6137]">
					<span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FFFBF2] px-3 shadow-[inset_0_0_0_1px_rgba(156,97,55,0.18)]">
						<Copy className="h-4 w-4" aria-hidden="true" />
						<span className="rounded-full bg-[#9C6137] px-2 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-[#FFFBF2]">
							{duplicateCount}
						</span>
						Duplicados
					</span>
					<span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FFFBF2] px-3 shadow-[inset_0_0_0_1px_rgba(156,97,55,0.18)]">
						<Heart className="h-4 w-4" aria-hidden="true" />
						Favorito
					</span>
				</div>
			</div>

			<div className="grid gap-5 px-4 py-6 sm:px-6 sm:py-7 lg:grid-cols-[minmax(0,1.14fr)_minmax(320px,0.86fr)]">
				<div className="rounded-[1.35rem] bg-[#FFF8EA] p-4 shadow-[0_14px_38px_rgba(31,26,20,0.06),inset_0_0_0_1px_rgba(232,223,204,0.9)] sm:p-5">
					<div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
						<div className="min-w-0">
							<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
								Actividad pública
							</p>
							<h2 className="mt-1 font-serif text-2xl font-normal leading-tight text-[#1F1A14] text-balance">
								Histórico de precios, agencias y portales
							</h2>
						</div>
						<span className="inline-flex min-h-10 items-center self-start rounded-full bg-[#FFFBF2] px-3 text-xs font-medium text-[#6F5E4A] shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)] sm:self-auto">
							{getObservationLabel(history.length)}
						</span>
					</div>

					{history.length > 0 ? (
						<ol className="grid gap-3">
							{history.map((row, index) => {
								const sourceHost = formatSourceHost(row.sourceUrl);

								return (
									<li
										key={`${row.portal}-${row.observedAt}-${index}`}
										className="group rounded-[1rem] bg-[#FFFBF2]/78 p-3 shadow-[0_7px_22px_rgba(31,26,20,0.045),inset_0_0_0_1px_rgba(232,223,204,0.74)] transition-[background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#FFFBF2] hover:shadow-[0_14px_34px_rgba(31,26,20,0.08),inset_0_0_0_1px_rgba(156,97,55,0.18)]"
									>
										<div className="grid gap-3 sm:grid-cols-[92px_32px_112px_minmax(0,1fr)] sm:items-start">
											<time className="text-xs font-medium tabular-nums text-[#6F5E4A] sm:pt-1.5">
												<span className="block text-[10px] uppercase tracking-[0.18em] text-[#6F5E4A]/72">
													Fecha
												</span>
												{formatDate(row.observedAt)}
											</time>
											<span className="relative hidden justify-center sm:flex">
												{index < history.length - 1 ? (
													<span
														className="absolute top-6 h-[calc(100%+1.25rem)] w-px bg-[#E8DFCC]"
														aria-hidden="true"
													/>
												) : null}
												<span
													className="relative z-10 mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#FFFBF2] shadow-[0_0_0_1px_rgba(156,97,55,0.22),0_5px_14px_rgba(156,97,55,0.12)]"
													aria-hidden="true"
												>
													<span className="h-2.5 w-2.5 rounded-full bg-[#9C6137]" />
												</span>
											</span>
											<p className="text-base font-semibold tabular-nums text-[#1F1A14] sm:pt-1">
												{formatEuro(row.askingPrice)}
											</p>
											<div className="min-w-0">
												<p className="text-sm leading-6 text-[#1F1A14] text-pretty">
													<span className="font-semibold uppercase text-[#9C6137]">
														{row.portal}
													</span>
													<span className="text-[#6F5E4A]"> · </span>
													<span>{getHistoryPartyLabel(row)}</span>
												</p>
												<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6F5E4A]">
													{row.daysPublished ? (
														<span className="rounded-full bg-[#FFF8EA] px-2.5 py-1 shadow-[inset_0_0_0_1px_rgba(232,223,204,0.85)]">
															{getDurationLabel(row.daysPublished)}
														</span>
													) : null}
													{row.sourceUrl ? (
														<a
															href={row.sourceUrl}
															target="_blank"
															rel="noreferrer"
															className="inline-flex min-h-10 items-center rounded-full px-2.5 underline decoration-[#9C6137]/40 underline-offset-4 transition-[color,text-decoration-color] duration-200 hover:text-[#9C6137] hover:decoration-[#9C6137]"
															title={sourceHost}
														>
															Ver fuente
														</a>
													) : null}
												</div>
											</div>
										</div>
									</li>
								);
							})}
						</ol>
					) : (
						<p className="rounded-[1rem] bg-[#FFFBF2]/78 p-4 text-sm leading-6 text-[#6F5E4A] shadow-[inset_0_0_0_1px_rgba(232,223,204,0.78)] text-pretty">
							Todavía no hay observaciones públicas suficientes para construir
							un histórico.
						</p>
					)}
				</div>

				<aside className="rounded-[1.35rem] bg-[#FFF8EA] p-4 shadow-[0_14px_38px_rgba(31,26,20,0.06),inset_0_0_0_1px_rgba(232,223,204,0.9)] sm:p-5">
					<div className="mb-5 flex items-end justify-between gap-3">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9C6137]">
								Permanencia
							</p>
							<h3 className="mt-1 font-serif text-2xl font-normal leading-tight text-[#1F1A14] text-balance">
								Días publicados
							</h3>
						</div>
						<span className="rounded-full bg-[#FFFBF2] px-3 py-2 text-xs font-medium text-[#6F5E4A] shadow-[inset_0_0_0_1px_rgba(232,223,204,0.95)]">
							{dossier.publicationDurations.length}
						</span>
					</div>

					{dossier.publicationDurations.length > 0 ? (
						<div className="grid gap-3">
							{dossier.publicationDurations.map((entry) => (
								<div
									key={`${entry.kind}-${entry.label}`}
									className="group rounded-[1rem] bg-[#FFFBF2]/78 p-3 shadow-[0_7px_22px_rgba(31,26,20,0.045),inset_0_0_0_1px_rgba(232,223,204,0.74)] transition-[background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#FFFBF2] hover:shadow-[0_14px_34px_rgba(31,26,20,0.08),inset_0_0_0_1px_rgba(156,97,55,0.18)]"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold uppercase text-[#1F1A14]">
												{entry.label}
											</p>
											<p className="mt-0.5 text-xs text-[#6F5E4A]">
												{getDurationKindLabel(entry.kind)}
											</p>
										</div>
										<span className="shrink-0 text-sm font-medium tabular-nums text-[#1F1A14]">
											{getDurationLabel(entry.daysPublished)}
										</span>
									</div>
									<div className="mt-3 h-3 rounded-full bg-[#E8DFCC]/70 p-[2px] shadow-[inset_0_1px_2px_rgba(31,26,20,0.08)]">
										<span
											className="block h-full rounded-full bg-[#9C6137] shadow-[0_5px_14px_rgba(156,97,55,0.22)] transition-[width] duration-300 ease-out"
											style={{
												width: `${Math.max(
													12,
													(entry.daysPublished / maxDuration) * 100,
												)}%`,
											}}
										/>
									</div>
								</div>
							))}
						</div>
					) : (
						<p className="rounded-[1rem] bg-[#FFFBF2]/78 p-4 text-sm leading-6 text-[#6F5E4A] shadow-[inset_0_0_0_1px_rgba(232,223,204,0.78)] text-pretty">
							Sin duración pública atribuible todavía.
						</p>
					)}
				</aside>
			</div>

			{dossier.imageGallery.length > 1 ? (
				<div className="mt-3 rounded-[1.15rem] bg-[#FFF8EA] p-3 shadow-[inset_0_0_0_1px_rgba(232,223,204,0.9)]">
					<div className="mb-3 flex items-center justify-between gap-3">
						<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9C6137]">
							Imágenes públicas
						</p>
						<span className="rounded-full bg-[#FFFBF2] px-2.5 py-1 text-xs font-medium tabular-nums text-[#6F5E4A] shadow-[inset_0_0_0_1px_rgba(232,223,204,0.8)]">
							{dossier.imageGallery.length - 1}
						</span>
					</div>
					<div className="flex gap-3 overflow-x-auto pb-1">
						{dossier.imageGallery.slice(1).map((image) => (
							<a
								key={image.imageUrl}
								href={image.sourceUrl}
								target="_blank"
								rel="noreferrer"
								className="group w-28 shrink-0 rounded-[0.9rem] bg-[#FFFBF2] p-1 shadow-[0_7px_18px_rgba(31,26,20,0.05),inset_0_0_0_1px_rgba(232,223,204,0.78)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(31,26,20,0.08),inset_0_0_0_1px_rgba(156,97,55,0.18)]"
								title={`${image.sourcePortal} · ${formatDate(image.observedAt)}`}
							>
								<img
									src={image.thumbnailUrl ?? image.imageUrl}
									alt={image.caption ?? "Imagen pública del inmueble"}
									className="h-20 w-full rounded-[0.65rem] object-cover outline outline-1 outline-black/10 transition-opacity duration-200 group-hover:opacity-85"
								/>
							</a>
						))}
					</div>
				</div>
			) : null}
		</section>
	);
}
