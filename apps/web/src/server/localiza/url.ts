import type { LocalizaErrorCode } from "@casedra/types";

const IDEALISTA_HOSTS = new Set(["idealista.com", "www.idealista.com"]);
const IDEALISTA_LISTING_PATH = /^\/inmueble\/(\d+)\/?$/;

const buildUrlError = (code: LocalizaErrorCode, message: string) => {
	const error = new Error(message) as Error & { code: LocalizaErrorCode };
	error.code = code;
	return error;
};

export const parseIdealistaListingUrl = (value: string) => {
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(value);
	} catch {
		throw buildUrlError("invalid_url", "Enter a valid Idealista listing URL.");
	}

	if (!IDEALISTA_HOSTS.has(parsedUrl.hostname)) {
		throw buildUrlError("unsupported_url", "Use a listing URL from idealista.com.");
	}

	if (
		(parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") ||
		parsedUrl.port
	) {
		throw buildUrlError(
			"unsupported_url",
			"Use a standard web URL from idealista.com.",
		);
	}

	const match = parsedUrl.pathname.match(IDEALISTA_LISTING_PATH);

	if (!match) {
		throw buildUrlError(
			"unsupported_url",
			"Use an Idealista property URL in the /inmueble/<id>/ format.",
		);
	}

	return {
		externalListingId: match[1],
		sourceUrl: `${parsedUrl.protocol}//${parsedUrl.host}/inmueble/${match[1]}/`,
	};
};
