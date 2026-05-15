"use client";

import { api } from "@casedra/api/convex";
import { Button, cn } from "@casedra/ui";
import { useMutation, useQuery } from "convex/react";
import {
	CheckCircle2,
	Circle,
	ExternalLink,
	RotateCcw,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type CopySuggestionStatus = "open" | "applied" | "dismissed";

const statusLabels: Record<CopySuggestionStatus, string> = {
	open: "Abiertas",
	applied: "Aplicadas",
	dismissed: "Descartadas",
};

const formatDate = (timestamp: number) =>
	new Intl.DateTimeFormat("es-ES", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
	}).format(new Date(timestamp));

export default function CopyReviewPage() {
	const [selectedStatus, setSelectedStatus] = useState<
		CopySuggestionStatus | "all"
	>("open");
	const suggestions = useQuery(api.copySuggestions.list, {
		limit: 150,
		status: selectedStatus === "all" ? undefined : selectedStatus,
	});
	const setStatus = useMutation(api.copySuggestions.setStatus);

	return (
		<main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
			<div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
						Revisión de textos
					</p>
					<h1 className="mt-2 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
						Sugerencias para el próximo deploy
					</h1>
				</div>
				<div className="flex flex-wrap gap-2">
					{(["open", "applied", "dismissed", "all"] as const).map((status) => {
						const active = selectedStatus === status;
						const label = status === "all" ? "Todas" : statusLabels[status];

						return (
							<Button
								key={status}
								type="button"
								variant={active ? "default" : "outline"}
								className="rounded-full"
								onClick={() => setSelectedStatus(status)}
							>
								{label}
							</Button>
						);
					})}
				</div>
			</div>

			<section className="mt-6 divide-y divide-border">
				{suggestions === undefined ? (
					<p className="py-10 text-sm text-muted-foreground">
						Cargando sugerencias...
					</p>
				) : suggestions.length === 0 ? (
					<p className="py-10 text-sm text-muted-foreground">
						No hay sugerencias en esta vista.
					</p>
				) : (
					suggestions.map((suggestion) => (
						<article
							key={suggestion._id}
							className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_220px]"
						>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
									<span
										className={cn(
											"inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1",
											suggestion.status === "open" &&
												"border-primary/35 text-primary",
										)}
									>
										<Circle className="h-2.5 w-2.5 fill-current" />
										{statusLabels[suggestion.status]}
									</span>
									<span>{formatDate(suggestion.createdAt)}</span>
									<span>{suggestion.submittedByEmail}</span>
								</div>

								<Link
									href={suggestion.pageUrl}
									className="mt-3 inline-flex max-w-full items-center gap-2 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
								>
									<span className="truncate">{suggestion.pagePath}</span>
									<ExternalLink className="h-3.5 w-3.5 shrink-0" />
								</Link>

								<div className="mt-4 grid gap-4 md:grid-cols-2">
									<div>
										<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
											Actual
										</p>
										<p className="mt-2 border-l border-border pl-3 text-sm leading-6 text-foreground">
											{suggestion.selectedText}
										</p>
									</div>
									<div>
										<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
											Propuesta
										</p>
										<p className="mt-2 border-l border-primary/40 pl-3 text-sm leading-6 text-foreground">
											{suggestion.suggestedText}
										</p>
									</div>
								</div>

								{suggestion.note ? (
									<p className="mt-4 text-sm leading-6 text-muted-foreground">
										{suggestion.note}
									</p>
								) : null}

								{suggestion.contextBefore || suggestion.contextAfter ? (
									<p className="mt-4 text-xs leading-5 text-muted-foreground">
										{suggestion.contextBefore
											? `${suggestion.contextBefore} `
											: ""}
										<span className="text-foreground">
											{suggestion.selectedText}
										</span>
										{suggestion.contextAfter
											? ` ${suggestion.contextAfter}`
											: ""}
									</p>
								) : null}
							</div>

							<div className="flex flex-wrap items-start gap-2 lg:justify-end">
								{suggestion.status !== "applied" ? (
									<Button
										type="button"
										className="gap-2 rounded-full"
										onClick={() =>
											void setStatus({
												id: suggestion._id,
												status: "applied",
											})
										}
									>
										<CheckCircle2 className="h-4 w-4" />
										Aplicada
									</Button>
								) : null}
								{suggestion.status !== "dismissed" ? (
									<Button
										type="button"
										variant="outline"
										className="gap-2 rounded-full"
										onClick={() =>
											void setStatus({
												id: suggestion._id,
												status: "dismissed",
											})
										}
									>
										<Trash2 className="h-4 w-4" />
										Descartar
									</Button>
								) : null}
								{suggestion.status !== "open" ? (
									<Button
										type="button"
										variant="outline"
										className="gap-2 rounded-full"
										onClick={() =>
											void setStatus({
												id: suggestion._id,
												status: "open",
											})
										}
									>
										<RotateCcw className="h-4 w-4" />
										Reabrir
									</Button>
								) : null}
							</div>
						</article>
					))
				)}
			</section>
		</main>
	);
}
