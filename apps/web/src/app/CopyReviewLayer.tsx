"use client";

import { api } from "@casedra/api/convex";
import { Button, Textarea, cn } from "@casedra/ui";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { CheckCircle2, MessageSquareQuote, PenLine, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { canUseCopyReview } from "@/lib/copy-review";

type SelectionSnapshot = {
	text: string;
	rect: {
		left: number;
		top: number;
		width: number;
	};
	pagePath: string;
	pageUrl: string;
	pageTitle?: string;
	contextBefore?: string;
	contextAfter?: string;
};

const MAX_SELECTED_TEXT_LENGTH = 1200;
const CONTEXT_WINDOW = 160;

const isEditableElement = (target: EventTarget | null) => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	return Boolean(
		target.closest(
			'input, textarea, select, [contenteditable="true"], [data-copy-review-ui="true"]',
		),
	);
};

const getBodyTextContext = (selectedText: string) => {
	const bodyText = document.body.innerText.replace(/\s+/g, " ");
	const selectedIndex = bodyText.indexOf(selectedText);

	if (selectedIndex < 0) {
		return {};
	}

	return {
		contextBefore: bodyText
			.slice(Math.max(0, selectedIndex - CONTEXT_WINDOW), selectedIndex)
			.trim(),
		contextAfter: bodyText
			.slice(
				selectedIndex + selectedText.length,
				selectedIndex + selectedText.length + CONTEXT_WINDOW,
			)
			.trim(),
	};
};

const getSelectionSnapshot = (): SelectionSnapshot | null => {
	const selection = window.getSelection();

	if (!selection || selection.rangeCount === 0) {
		return null;
	}

	const selectedText = selection
		.toString()
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_SELECTED_TEXT_LENGTH);

	if (selectedText.length < 2) {
		return null;
	}

	const range = selection.getRangeAt(0);
	const container =
		range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
			? range.commonAncestorContainer
			: range.commonAncestorContainer.parentElement;

	if (
		container instanceof HTMLElement &&
		container.closest('[data-copy-review-ui="true"]')
	) {
		return null;
	}

	const rect = range.getBoundingClientRect();

	if (rect.width <= 0 && rect.height <= 0) {
		return null;
	}

	const { contextBefore, contextAfter } = getBodyTextContext(selectedText);

	return {
		text: selectedText,
		rect: {
			left: rect.left,
			top: rect.top,
			width: rect.width,
		},
		pagePath: window.location.pathname,
		pageUrl: window.location.href,
		pageTitle: document.title || undefined,
		contextBefore,
		contextAfter,
	};
};

const getButtonPosition = (selection: SelectionSnapshot) => ({
	left: Math.max(
		12,
		Math.min(
			window.innerWidth - 136,
			selection.rect.left + selection.rect.width / 2 - 68,
		),
	),
	top: Math.max(76, selection.rect.top - 52),
});

export function CopyReviewLayer() {
	const pathname = usePathname();
	const { user, isLoaded } = useUser();
	const submitSuggestion = useMutation(api.copySuggestions.submit);
	const emailAddress = user?.primaryEmailAddress?.emailAddress;
	const canReview = isLoaded && canUseCopyReview(emailAddress);
	const [enabled, setEnabled] = useState(false);
	const [selection, setSelection] = useState<SelectionSnapshot | null>(null);
	const [draft, setDraft] = useState<SelectionSnapshot | null>(null);
	const [suggestedText, setSuggestedText] = useState("");
	const [note, setNote] = useState("");
	const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
		"idle",
	);

	const buttonPosition = useMemo(
		() => (selection ? getButtonPosition(selection) : null),
		[selection],
	);

	useEffect(() => {
		if (!enabled) {
			setSelection(null);
			setDraft(null);
			return;
		}

		const refreshSelection = (event: MouseEvent | KeyboardEvent) => {
			if (isEditableElement(event.target)) {
				return;
			}

			window.setTimeout(() => {
				setSelection(getSelectionSnapshot());
			}, 60);
		};

		const clearSelection = () => {
			setSelection(null);
		};

		document.addEventListener("mouseup", refreshSelection);
		document.addEventListener("keyup", refreshSelection);
		window.addEventListener("scroll", clearSelection, { passive: true });

		return () => {
			document.removeEventListener("mouseup", refreshSelection);
			document.removeEventListener("keyup", refreshSelection);
			window.removeEventListener("scroll", clearSelection);
		};
	}, [enabled]);

	useEffect(() => {
		setSelection(null);
		setDraft(null);
		setStatus("idle");
	}, [pathname]);

	if (!canReview) {
		return null;
	}

	const openDraft = () => {
		if (!selection) {
			return;
		}

		setDraft(selection);
		setSuggestedText(selection.text);
		setNote("");
		setStatus("idle");
		setSelection(null);
	};

	const closeDraft = () => {
		setDraft(null);
		setSuggestedText("");
		setNote("");
		setStatus("idle");
	};

	const handleSubmit = async () => {
		if (!draft || !suggestedText.trim()) {
			return;
		}

		setStatus("saving");
		try {
			await submitSuggestion({
				selectedText: draft.text,
				suggestedText,
				note: note.trim() || undefined,
				pagePath: draft.pagePath,
				pageUrl: draft.pageUrl,
				pageTitle: draft.pageTitle,
				contextBefore: draft.contextBefore,
				contextAfter: draft.contextAfter,
			});
			setStatus("saved");
			window.getSelection()?.removeAllRanges();
		} catch {
			setStatus("failed");
		}
	};

	return (
		<>
			<div className="fixed bottom-4 right-4 z-[80]" data-copy-review-ui="true">
				<Button
					type="button"
					variant={enabled ? "default" : "outline"}
					className={cn(
						"gap-2 rounded-full border-border bg-background/95 shadow-[0_12px_34px_rgba(31,26,20,0.13)] backdrop-blur",
						enabled && "border-primary bg-primary text-primary-foreground",
					)}
					onClick={() => setEnabled((current) => !current)}
					aria-pressed={enabled}
					aria-label={
						enabled ? "Desactivar revisión de textos" : "Revisar textos"
					}
				>
					<PenLine className="h-4 w-4" aria-hidden="true" />
					<span>{enabled ? "Revisión activa" : "Revisar textos"}</span>
				</Button>
			</div>

			{enabled && selection && buttonPosition ? (
				<Button
					type="button"
					className="fixed z-[90] gap-2 rounded-full shadow-[0_16px_40px_rgba(31,26,20,0.18)]"
					style={buttonPosition}
					onClick={openDraft}
					data-copy-review-ui="true"
				>
					<MessageSquareQuote className="h-4 w-4" aria-hidden="true" />
					Sugerir
				</Button>
			) : null}

			{draft ? (
				<section
					className="fixed bottom-20 right-4 z-[95] w-[calc(100vw-2rem)] max-w-[430px] rounded-2xl border border-border bg-background/98 p-4 shadow-[0_24px_80px_rgba(31,26,20,0.18)] backdrop-blur"
					data-copy-review-ui="true"
					aria-label="Sugerencia de texto"
				>
					<div className="flex items-start justify-between gap-4">
						<div>
							<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
								Sugerencia de texto
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								Se guarda con la página exacta.
							</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 rounded-full"
							onClick={closeDraft}
							aria-label="Cerrar"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</Button>
					</div>

					<div className="mt-4 border-l border-primary/35 pl-3 text-sm leading-6 text-foreground">
						{draft.text}
					</div>

					<label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Nueva versión
					</label>
					<Textarea
						className="mt-2 min-h-24 resize-none rounded-xl"
						value={suggestedText}
						onChange={(event) => {
							setSuggestedText(event.target.value);
							setStatus("idle");
						}}
						autoFocus
					/>

					<label className="mt-3 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Nota
					</label>
					<Textarea
						className="mt-2 min-h-16 resize-none rounded-xl"
						value={note}
						placeholder="Opcional"
						onChange={(event) => {
							setNote(event.target.value);
							setStatus("idle");
						}}
					/>

					<div className="mt-4 flex items-center justify-between gap-3">
						<p
							className={cn(
								"text-sm text-muted-foreground",
								status === "saved" && "text-primary",
								status === "failed" && "text-destructive",
							)}
							aria-live="polite"
						>
							{status === "saving"
								? "Guardando..."
								: status === "saved"
									? "Guardado para revisar."
									: status === "failed"
										? "No se pudo guardar."
										: ""}
						</p>
						<Button
							type="button"
							className="gap-2 rounded-full"
							onClick={status === "saved" ? closeDraft : handleSubmit}
							disabled={!suggestedText.trim() || status === "saving"}
						>
							{status === "saved" ? (
								<CheckCircle2 className="h-4 w-4" aria-hidden="true" />
							) : null}
							{status === "saved" ? "Cerrar" : "Guardar"}
						</Button>
					</div>
				</section>
			) : null}
		</>
	);
}
