import { z } from "zod";

export const locationResolutionStatusSchema = z.enum([
	"exact_match",
	"building_match",
	"needs_confirmation",
	"unresolved",
	"manual_override",
]);

export const listingLocationSchema = z.object({
	street: z.string().min(1, "Street address is required"),
	city: z.string().min(1, "City is required"),
	stateOrProvince: z.string().min(1, "State or province is required"),
	postalCode: z.string().min(1, "Postal code is required"),
	country: z.string().min(1, "Country is required"),
});

export const listingDetailsSchema = z.object({
	priceAmount: z.number().nonnegative(),
	currencyCode: z.enum(["EUR", "USD"]).default("EUR"),
	bedrooms: z.number().int().min(0),
	bathrooms: z.number().int().min(0),
	interiorAreaSquareMeters: z.number().int().positive().optional(),
	lotAreaSquareMeters: z.number().int().positive().optional(),
	yearBuilt: z
		.number()
		.int()
		.min(1800)
		.max(new Date().getFullYear())
		.optional(),
	propertyType: z.enum([
		"single_family",
		"multi_family",
		"condo",
		"townhouse",
		"land",
		"commercial",
	]),
	description: z.string().min(1, "Listing description is required"),
});

export const listingMediaAssetSchema = z.object({
	url: z.string().url(),
	type: z.enum(["photo", "video", "floor_plan", "virtual_tour", "document"]),
	caption: z.string().optional(),
	tags: z.array(z.string()).optional(),
});

export const listingSourceMetadataSchema = z.object({
	provider: z.literal("idealista"),
	externalListingId: z.string().min(1, "External listing id is required"),
	sourceUrl: z.string().url("Source URL must be a valid URL"),
});

export const localizaDossierImageSchema = z.object({
	imageUrl: z.string().url(),
	thumbnailUrl: z.string().url().optional(),
	sourcePortal: z.string().min(1),
	sourceUrl: z.string().url(),
	observedAt: z.string().datetime(),
	lastVerifiedAt: z.string().datetime().optional(),
	sourcePublishedAt: z.string().datetime().optional(),
	caption: z.string().min(1).optional(),
});

export const localizaOnlineEvidenceKindSchema = z.enum([
	"listing_archive",
	"building_cadastre",
	"building_condition",
	"official_cadastre",
	"energy_certificate",
	"solar_potential",
	"risk_overlay",
	"local_amenity",
	"planning_heritage",
	"market_benchmark",
	"licensed_feed",
]);

export const localizaOnlineEvidenceItemSchema = z.object({
	label: z.string().min(1),
	value: z.string().min(1),
	sourceLabel: z.string().min(1),
	sourceUrl: z.string().url().optional(),
	observedAt: z.string().datetime().optional(),
	kind: localizaOnlineEvidenceKindSchema,
});

export const localizaPropertyDossierSchema = z.object({
	listingSnapshot: z.object({
		title: z.string().min(1).optional(),
		leadImageUrl: z.string().url().optional(),
		askingPrice: z.number().nonnegative().optional(),
		currencyCode: z.literal("EUR").optional(),
		priceIncludesParking: z.boolean().optional(),
		areaM2: z.number().positive().optional(),
		bedrooms: z.number().int().nonnegative().optional(),
		bathrooms: z.number().int().nonnegative().optional(),
		floorText: z.string().min(1).optional(),
		isExterior: z.boolean().optional(),
		hasElevator: z.boolean().optional(),
		sourcePortal: z.literal("idealista"),
		sourceUrl: z.string().url(),
	}),
	imageGallery: z.array(localizaDossierImageSchema).default([]),
	onlineEvidence: z.array(localizaOnlineEvidenceItemSchema).default([]),
	officialIdentity: z.object({
		proposedAddressLabel: z.string().min(1).optional(),
		street: z.string().min(1).optional(),
		number: z.string().min(1).optional(),
		staircase: z.string().min(1).optional(),
		floor: z.string().min(1).optional(),
		door: z.string().min(1).optional(),
		postalCode: z.string().min(1).optional(),
		municipality: z.string().min(1).optional(),
		province: z.string().min(1).optional(),
		parcelRef14: z.string().min(1).optional(),
		unitRef20: z.string().min(1).optional(),
		officialSource: z.string().min(1),
		officialSourceUrl: z.string().url().optional(),
	}),
	publicHistory: z
		.array(
			z.object({
				observedAt: z.string().datetime(),
				askingPrice: z.number().nonnegative().optional(),
				currencyCode: z.literal("EUR").optional(),
				portal: z.string().min(1),
				advertiserName: z.string().min(1).optional(),
				agencyName: z.string().min(1).optional(),
				sourceUrl: z.string().url().optional(),
				daysPublished: z.number().int().positive().optional(),
			}),
		)
		.default([]),
	duplicateGroup: z.object({
		count: z.number().int().nonnegative(),
		records: z.array(
			z.object({
				portal: z.string().min(1),
				sourceUrl: z.string().url().optional(),
				advertiserName: z.string().min(1).optional(),
				agencyName: z.string().min(1).optional(),
				firstSeenAt: z.string().datetime().optional(),
				lastSeenAt: z.string().datetime().optional(),
				askingPrice: z.number().nonnegative().optional(),
			}),
		),
	}),
	publicationDurations: z
		.array(
			z.object({
				label: z.string().min(1),
				kind: z.enum(["advertiser", "agency", "portal"]),
				daysPublished: z.number().int().positive(),
			}),
		)
		.default([]),
	actions: z.object({
		reportDownloadUrl: z.string().min(1).optional(),
		valuationUrl: z.string().min(1).optional(),
	}),
});

export const listingLocationResolutionSchema = z.object({
	status: locationResolutionStatusSchema,
	confidenceScore: z.number().min(0).max(1),
	officialSource: z.string().min(1, "Official source is required"),
	officialSourceUrl: z.string().url().optional(),
	territoryAdapter: z
		.enum([
			"state_catastro",
			"navarra_rtn",
			"alava_catastro",
			"bizkaia_catastro",
			"gipuzkoa_catastro",
		])
		.optional(),
	requestedStrategy: z
		.enum(["auto", "idealista_api", "firecrawl", "browser_worker"])
		.optional(),
	actualAcquisitionMethod: z
		.enum(["url_parse", "idealista_api", "firecrawl", "browser_worker"])
		.optional(),
	parcelRef14: z.string().min(1).optional(),
	unitRef20: z.string().min(1).optional(),
	resolvedAddressLabel: z.string().min(1).optional(),
	resolverVersion: z.string().min(1, "Resolver version is required"),
	resolvedAt: z.string().datetime("Resolved date must be a valid ISO datetime"),
	candidateCount: z.number().int().nonnegative().optional(),
	reasonCodes: z.array(z.string().min(1)).default([]),
});

export const listingCreateInputSchema = z
	.object({
		title: z.string().min(1, "Listing title is required"),
		slug: z.string().min(1).optional(),
		sourceType: z.enum(["manual", "firecrawl", "idealista"]),
		sourceUrl: z.string().url().optional(),
		sourceMetadata: listingSourceMetadataSchema.optional(),
		locationResolution: listingLocationResolutionSchema.optional(),
		propertyDossier: localizaPropertyDossierSchema.optional(),
		location: listingLocationSchema,
		displayAddressLabel: z.string().min(1).optional(),
		details: listingDetailsSchema,
		media: z.array(listingMediaAssetSchema).default([]),
	})
	.superRefine((input, ctx) => {
		if (input.sourceType === "manual") {
			if (input.sourceUrl) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["sourceUrl"],
					message: "Manual listings cannot include a source URL",
				});
			}

			if (input.sourceMetadata) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["sourceMetadata"],
					message: "Manual listings cannot include source metadata",
				});
			}

			if (input.locationResolution) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["locationResolution"],
					message:
						"Manual listings cannot include location resolution metadata",
				});
			}

			if (input.propertyDossier) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["propertyDossier"],
					message: "Manual listings cannot include Localiza property reports",
				});
			}

			return;
		}

		if (!input.sourceUrl) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["sourceUrl"],
				message: "Imported listings require a source URL",
			});
		}

		if (input.sourceType === "firecrawl") {
			if (input.sourceMetadata) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["sourceMetadata"],
					message:
						"Firecrawl listings cannot include Idealista source metadata",
				});
			}

			if (input.locationResolution) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["locationResolution"],
					message:
						"Only Idealista listings can include location resolution metadata",
				});
			}

			if (input.propertyDossier) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["propertyDossier"],
					message:
						"Only Idealista listings can include Localiza property reports",
				});
			}

			return;
		}

		if (
			(input.locationResolution || input.propertyDossier) &&
			!input.sourceMetadata
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["sourceMetadata"],
				message: "Idealista Localiza metadata requires source metadata",
			});
		}

		if (
			input.sourceMetadata &&
			input.sourceUrl &&
			input.sourceMetadata.sourceUrl !== input.sourceUrl
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["sourceMetadata", "sourceUrl"],
				message: "Idealista source metadata must match the listing source URL",
			});
		}

		if (
			input.propertyDossier &&
			input.sourceUrl &&
			input.propertyDossier.listingSnapshot.sourceUrl !== input.sourceUrl
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["propertyDossier", "listingSnapshot", "sourceUrl"],
				message: "Localiza property report must match the listing source URL",
			});
		}
	});

export const listingBatchCreateInputSchema = z.object({
	idempotencyKey: z.string().min(1, "Idempotency key is required"),
	listings: z
		.array(listingCreateInputSchema)
		.min(1, "At least one listing is required"),
});

export const listingFiltersSchema = z.object({
	status: z.enum(["draft", "active", "sold", "archived"]).optional(),
	search: z.string().optional(),
});

export const resolveIdealistaLocationInputSchema = z.object({
	url: z.string().url("Listing URL must be a valid URL"),
	strategy: z
		.enum(["auto", "idealista_api", "firecrawl", "browser_worker"])
		.default("auto"),
});

export const submitLocalizaAddressFeedbackInputSchema = z
	.object({
		sourceUrl: z.string().url("Listing URL must be a valid URL"),
		externalListingId: z.string().min(1).optional(),
		verdict: z.enum(["correct", "incorrect"]),
		resultStatus: z
			.enum(["exact_match", "building_match", "needs_confirmation", "unresolved"])
			.optional(),
		resolverVersion: z.string().min(1).optional(),
		territoryAdapter: z
			.enum([
				"state_catastro",
				"navarra_rtn",
				"alava_catastro",
				"bizkaia_catastro",
				"gipuzkoa_catastro",
			])
			.optional(),
		resolvedAddressLabel: z.string().min(1).optional(),
		selectedCandidateId: z.string().min(1).optional(),
		selectedCandidateLabel: z.string().min(1).optional(),
		correctedAddressLabel: z.string().min(1).optional(),
		reasonCodes: z.array(z.string()).optional(),
	})
	.superRefine((input, ctx) => {
		if (input.verdict === "incorrect" && !input.correctedAddressLabel) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["correctedAddressLabel"],
				message: "Correct address is required when marking a result incorrect",
			});
		}
	});

export const captacionBoundaryPointSchema = z.object({
	lat: z.number().min(35).max(44.5),
	lng: z.number().min(-10).max(4.5),
});

export const rankCaptacionBuildingsInputSchema = z.object({
	boundary: z
		.array(captacionBoundaryPointSchema)
		.min(3, "Dibuja al menos tres puntos.")
		.max(80, "La zona es demasiado compleja para una búsqueda."),
});
