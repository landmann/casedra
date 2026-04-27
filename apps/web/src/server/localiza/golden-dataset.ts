import type {
	IdealistaAcquisitionMethod,
	IdealistaSignals,
	ListingLocation,
	LocalizaTerritoryAdapter,
	ResolveIdealistaLocationCandidate,
	ResolveIdealistaLocationStatus,
} from "@casedra/types";

export const LOCALIZA_GOLDEN_MIN_FIXTURE_COUNT = 30;
export const LOCALIZA_GOLDEN_BUILDING_OR_BETTER_RATE = 0.8;
export const LOCALIZA_GOLDEN_HUMAN_UNIT_EXACT_RATE = 0.6;

const officialSourceLabelByTerritory: Record<LocalizaTerritoryAdapter, string> = {
	state_catastro: "Dirección General del Catastro",
	navarra_rtn: "Registro de la Riqueza Territorial de Navarra",
	alava_catastro: "Catastro de Alava",
	bizkaia_catastro: "Catastro de Bizkaia",
	gipuzkoa_catastro: "Catastro de Gipuzkoa",
};

type LocalizaFrozenFixtureSpec = {
	fixtureId: string;
	listingId: string;
	territoryAdapter: LocalizaTerritoryAdapter;
	municipality: string;
	province: string;
	postalCode: string;
	street: string;
	expectedStatus: ResolveIdealistaLocationStatus;
	confidenceScore: number;
	hiddenAddress: boolean;
	humanUnitResolvable: boolean;
	acquisitionMethod?: IdealistaAcquisitionMethod;
	candidateCount?: number;
};

export type LocalizaGoldenFrozenFixture = {
	fixtureId: string;
	layer: "frozen_normalized_signals";
	hiddenAddress: boolean;
	humanUnitResolvable: boolean;
	signals: IdealistaSignals;
	officialResolution: {
		status: ResolveIdealistaLocationStatus;
		confidenceScore: number;
		officialSource: string;
		resolvedAddressLabel?: string;
		parcelRef14?: string;
		unitRef20?: string;
		prefillLocation?: ListingLocation;
		candidates: ResolveIdealistaLocationCandidate[];
		reasonCodes: string[];
		matchedSignals: string[];
		discardedSignals: string[];
		territoryAdapter: LocalizaTerritoryAdapter;
	};
};

type LocalizaLiveLocationHint = Pick<
	ListingLocation,
	"street" | "city" | "stateOrProvince" | "country"
> &
	Partial<Pick<ListingLocation, "postalCode">>;

export type LocalizaGoldenLiveFixture = {
	fixtureId: string;
	layer: "live_link_regression";
	sourceUrl: `https://${string}idealista.com/inmueble/${string}`;
	expectedStatus: ResolveIdealistaLocationStatus;
	territoryAdapter: LocalizaTerritoryAdapter;
	humanUnitResolvable: boolean;
	expectedLocationHint: LocalizaLiveLocationHint;
	validationStatus: "pending_official_validation" | "officially_validated";
	observedAt: string;
	validationNotes: string;
};

const frozenFixtureSpecs: LocalizaFrozenFixtureSpec[] = [
	{
		fixtureId: "state-madrid-hidden-building-001",
		listingId: "910000001",
		territoryAdapter: "state_catastro",
		municipality: "Madrid",
		province: "Madrid",
		postalCode: "28013",
		street: "Calle Mayor 12",
		expectedStatus: "building_match",
		confidenceScore: 0.87,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "state-madrid-exact-unit-002",
		listingId: "910000002",
		territoryAdapter: "state_catastro",
		municipality: "Madrid",
		province: "Madrid",
		postalCode: "28009",
		street: "Calle de Alcala 123",
		expectedStatus: "exact_match",
		confidenceScore: 0.96,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "state-madrid-hidden-exact-003",
		listingId: "910000003",
		territoryAdapter: "state_catastro",
		municipality: "Madrid",
		province: "Madrid",
		postalCode: "28004",
		street: "Calle de Fuencarral 41",
		expectedStatus: "exact_match",
		confidenceScore: 0.94,
		hiddenAddress: true,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "state-barcelona-hidden-building-004",
		listingId: "910000004",
		territoryAdapter: "state_catastro",
		municipality: "Barcelona",
		province: "Barcelona",
		postalCode: "08007",
		street: "Passeig de Gracia 84",
		expectedStatus: "building_match",
		confidenceScore: 0.88,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "state-barcelona-exact-unit-005",
		listingId: "910000005",
		territoryAdapter: "state_catastro",
		municipality: "Barcelona",
		province: "Barcelona",
		postalCode: "08002",
		street: "Carrer de la Portaferrissa 18",
		expectedStatus: "exact_match",
		confidenceScore: 0.95,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "state-valencia-hidden-building-006",
		listingId: "910000006",
		territoryAdapter: "state_catastro",
		municipality: "Valencia",
		province: "Valencia",
		postalCode: "46002",
		street: "Calle Colon 21",
		expectedStatus: "building_match",
		confidenceScore: 0.86,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "state-sevilla-hidden-unresolved-007",
		listingId: "910000007",
		territoryAdapter: "state_catastro",
		municipality: "Sevilla",
		province: "Sevilla",
		postalCode: "41004",
		street: "Calle Sierpes 9",
		expectedStatus: "unresolved",
		confidenceScore: 0.28,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "state-malaga-hidden-candidates-008",
		listingId: "910000008",
		territoryAdapter: "state_catastro",
		municipality: "Malaga",
		province: "Malaga",
		postalCode: "29015",
		street: "Calle Granada 33",
		expectedStatus: "needs_confirmation",
		confidenceScore: 0.78,
		hiddenAddress: false,
		humanUnitResolvable: false,
		candidateCount: 3,
	},
	{
		fixtureId: "state-zaragoza-exact-unit-009",
		listingId: "910000009",
		territoryAdapter: "state_catastro",
		municipality: "Zaragoza",
		province: "Zaragoza",
		postalCode: "50003",
		street: "Calle Alfonso I 16",
		expectedStatus: "exact_match",
		confidenceScore: 0.93,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "state-murcia-hidden-building-010",
		listingId: "910000010",
		territoryAdapter: "state_catastro",
		municipality: "Murcia",
		province: "Murcia",
		postalCode: "30004",
		street: "Calle Traperia 22",
		expectedStatus: "building_match",
		confidenceScore: 0.85,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "state-palma-exact-unit-011",
		listingId: "910000011",
		territoryAdapter: "state_catastro",
		municipality: "Palma",
		province: "Illes Balears",
		postalCode: "07001",
		street: "Carrer de Sant Miquel 7",
		expectedStatus: "exact_match",
		confidenceScore: 0.94,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "state-coruna-hidden-building-012",
		listingId: "910000012",
		territoryAdapter: "state_catastro",
		municipality: "A Coruna",
		province: "A Coruna",
		postalCode: "15003",
		street: "Rua Real 45",
		expectedStatus: "building_match",
		confidenceScore: 0.84,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "state-valladolid-hidden-exact-013",
		listingId: "910000013",
		territoryAdapter: "state_catastro",
		municipality: "Valladolid",
		province: "Valladolid",
		postalCode: "47001",
		street: "Calle Santiago 14",
		expectedStatus: "exact_match",
		confidenceScore: 0.92,
		hiddenAddress: true,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "state-granada-hidden-building-014",
		listingId: "910000014",
		territoryAdapter: "state_catastro",
		municipality: "Granada",
		province: "Granada",
		postalCode: "18009",
		street: "Calle Reyes Catolicos 31",
		expectedStatus: "building_match",
		confidenceScore: 0.85,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "state-alicante-exact-unit-015",
		listingId: "910000015",
		territoryAdapter: "state_catastro",
		municipality: "Alicante",
		province: "Alicante",
		postalCode: "03001",
		street: "Avenida Maisonnave 19",
		expectedStatus: "exact_match",
		confidenceScore: 0.93,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "state-toledo-hidden-candidates-016",
		listingId: "910000016",
		territoryAdapter: "state_catastro",
		municipality: "Toledo",
		province: "Toledo",
		postalCode: "45001",
		street: "Calle Comercio 28",
		expectedStatus: "needs_confirmation",
		confidenceScore: 0.76,
		hiddenAddress: false,
		humanUnitResolvable: false,
		candidateCount: 2,
	},
	{
		fixtureId: "state-cordoba-hidden-building-017",
		listingId: "910000017",
		territoryAdapter: "state_catastro",
		municipality: "Cordoba",
		province: "Cordoba",
		postalCode: "14003",
		street: "Calle Claudio Marcelo 6",
		expectedStatus: "building_match",
		confidenceScore: 0.84,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "state-salamanca-exact-unit-018",
		listingId: "910000018",
		territoryAdapter: "state_catastro",
		municipality: "Salamanca",
		province: "Salamanca",
		postalCode: "37002",
		street: "Calle Toro 11",
		expectedStatus: "exact_match",
		confidenceScore: 0.94,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "navarra-pamplona-exact-unit-019",
		listingId: "910000019",
		territoryAdapter: "navarra_rtn",
		municipality: "Pamplona",
		province: "Navarra",
		postalCode: "31001",
		street: "Calle Estafeta 5",
		expectedStatus: "exact_match",
		confidenceScore: 0.93,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "navarra-tudela-hidden-candidates-020",
		listingId: "910000020",
		territoryAdapter: "navarra_rtn",
		municipality: "Tudela",
		province: "Navarra",
		postalCode: "31500",
		street: "Calle Herrerias 10",
		expectedStatus: "needs_confirmation",
		confidenceScore: 0.77,
		hiddenAddress: false,
		humanUnitResolvable: false,
		candidateCount: 3,
	},
	{
		fixtureId: "navarra-estella-hidden-building-021",
		listingId: "910000021",
		territoryAdapter: "navarra_rtn",
		municipality: "Estella-Lizarra",
		province: "Navarra",
		postalCode: "31200",
		street: "Calle Mayor 25",
		expectedStatus: "building_match",
		confidenceScore: 0.85,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "alava-vitoria-exact-unit-022",
		listingId: "910000022",
		territoryAdapter: "alava_catastro",
		municipality: "Vitoria-Gasteiz",
		province: "Araba",
		postalCode: "01005",
		street: "Calle Dato 18",
		expectedStatus: "exact_match",
		confidenceScore: 0.92,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "alava-laudio-hidden-building-023",
		listingId: "910000023",
		territoryAdapter: "alava_catastro",
		municipality: "Laudio",
		province: "Araba",
		postalCode: "01400",
		street: "Zumalakarregi Etorbidea 4",
		expectedStatus: "building_match",
		confidenceScore: 0.84,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "alava-laguardia-hidden-candidates-024",
		listingId: "910000024",
		territoryAdapter: "alava_catastro",
		municipality: "Laguardia",
		province: "Araba",
		postalCode: "01300",
		street: "Calle Mayor 2",
		expectedStatus: "needs_confirmation",
		confidenceScore: 0.75,
		hiddenAddress: false,
		humanUnitResolvable: false,
		candidateCount: 2,
	},
	{
		fixtureId: "bizkaia-bilbao-exact-unit-025",
		listingId: "910000025",
		territoryAdapter: "bizkaia_catastro",
		municipality: "Bilbao",
		province: "Bizkaia",
		postalCode: "48009",
		street: "Gran Via 38",
		expectedStatus: "exact_match",
		confidenceScore: 0.93,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "bizkaia-getxo-hidden-building-026",
		listingId: "910000026",
		territoryAdapter: "bizkaia_catastro",
		municipality: "Getxo",
		province: "Bizkaia",
		postalCode: "48992",
		street: "Avenida Basagoiti 12",
		expectedStatus: "building_match",
		confidenceScore: 0.84,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "bizkaia-durango-hidden-candidates-027",
		listingId: "910000027",
		territoryAdapter: "bizkaia_catastro",
		municipality: "Durango",
		province: "Bizkaia",
		postalCode: "48200",
		street: "Askatasun Etorbidea 7",
		expectedStatus: "needs_confirmation",
		confidenceScore: 0.76,
		hiddenAddress: false,
		humanUnitResolvable: false,
		candidateCount: 2,
	},
	{
		fixtureId: "gipuzkoa-donostia-exact-unit-028",
		listingId: "910000028",
		territoryAdapter: "gipuzkoa_catastro",
		municipality: "Donostia",
		province: "Gipuzkoa",
		postalCode: "20005",
		street: "Avenida de la Libertad 20",
		expectedStatus: "exact_match",
		confidenceScore: 0.93,
		hiddenAddress: false,
		humanUnitResolvable: true,
	},
	{
		fixtureId: "gipuzkoa-irun-hidden-building-029",
		listingId: "910000029",
		territoryAdapter: "gipuzkoa_catastro",
		municipality: "Irun",
		province: "Gipuzkoa",
		postalCode: "20302",
		street: "Paseo Colon 15",
		expectedStatus: "building_match",
		confidenceScore: 0.84,
		hiddenAddress: true,
		humanUnitResolvable: false,
	},
	{
		fixtureId: "gipuzkoa-tolosa-hidden-candidates-030",
		listingId: "910000030",
		territoryAdapter: "gipuzkoa_catastro",
		municipality: "Tolosa",
		province: "Gipuzkoa",
		postalCode: "20400",
		street: "Kale Nagusia 9",
		expectedStatus: "needs_confirmation",
		confidenceScore: 0.76,
		hiddenAddress: false,
		humanUnitResolvable: false,
		candidateCount: 2,
	},
];

const buildPrefillLocation = (
	spec: LocalizaFrozenFixtureSpec,
): ListingLocation => ({
	street: spec.street,
	city: spec.municipality,
	stateOrProvince: spec.province,
	postalCode: spec.postalCode,
	country: "Spain",
});

const candidateCountForStatus = (spec: LocalizaFrozenFixtureSpec) =>
	spec.candidateCount ?? (spec.expectedStatus === "needs_confirmation" ? 2 : 0);

const buildFrozenFixture = (
	spec: LocalizaFrozenFixtureSpec,
): LocalizaGoldenFrozenFixture => {
	const prefillLocation = buildPrefillLocation(spec);
	const candidateCount = candidateCountForStatus(spec);

	return {
		fixtureId: spec.fixtureId,
		layer: "frozen_normalized_signals",
		hiddenAddress: spec.hiddenAddress,
		humanUnitResolvable: spec.humanUnitResolvable,
		signals: {
			provider: "idealista",
			listingId: spec.listingId,
			sourceUrl: `fixture://localiza/${spec.fixtureId}`,
			propertyType: "homes",
			portalHint: spec.street.match(/\d+/)?.[0],
			municipality: spec.municipality,
			province: spec.province,
			postalCodeHint: spec.postalCode,
			listingText: spec.hiddenAddress
				? `Idealista hidden-address fixture near ${spec.municipality}.`
				: `${spec.street}, ${spec.municipality}`,
			acquisitionMethod: spec.acquisitionMethod ?? "firecrawl",
			acquiredAt: "2026-04-24T00:00:00.000Z",
		},
		officialResolution: {
			status: spec.expectedStatus,
			confidenceScore: spec.confidenceScore,
			officialSource: officialSourceLabelByTerritory[spec.territoryAdapter],
			resolvedAddressLabel: `${spec.street}, ${spec.municipality}`,
			parcelRef14:
				spec.expectedStatus === "unresolved"
					? undefined
					: `${spec.listingId.slice(0, 7)}CAT${spec.listingId.slice(-4)}`,
			unitRef20:
				spec.expectedStatus === "exact_match" && spec.humanUnitResolvable
					? `${spec.listingId.slice(0, 7)}CAT${spec.listingId.slice(-4)}0001`
					: undefined,
			prefillLocation:
				spec.expectedStatus === "unresolved" ? undefined : prefillLocation,
			candidates: Array.from({ length: candidateCount }, (_, index) => ({
				id: `${spec.fixtureId}-candidate-${index + 1}`,
				label: `${spec.street}, ${spec.municipality} candidate ${index + 1}`,
				parcelRef14: `${spec.listingId.slice(0, 7)}ALT${index + 1}`,
				score: Math.max(spec.confidenceScore - index * 0.03, 0),
				reasonCodes: ["golden_fixture_candidate"],
				prefillLocation,
			})),
			reasonCodes: [
				"golden_fixture",
				`${spec.territoryAdapter}_${spec.expectedStatus}`,
			],
			matchedSignals:
				spec.expectedStatus === "unresolved"
					? ["idealista_listing_id"]
					: ["idealista_listing_id", "municipality", "province"],
			discardedSignals:
				spec.expectedStatus === "unresolved" ? ["official_candidates"] : [],
			territoryAdapter: spec.territoryAdapter,
		},
	};
};

export const localizaGoldenFrozenFixtures =
	frozenFixtureSpecs.map(buildFrozenFixture);

export const localizaGoldenLiveFixtures: LocalizaGoldenLiveFixture[] = [
	{
		fixtureId: "live-madrid-caleruega-110411564",
		layer: "live_link_regression",
		sourceUrl: "https://www.idealista.com/inmueble/110411564/",
		expectedStatus: "building_match",
		territoryAdapter: "state_catastro",
		humanUnitResolvable: false,
		expectedLocationHint: {
			street: "Calle de Caleruega",
			city: "Madrid",
			stateOrProvince: "Madrid",
			country: "Spain",
		},
		validationStatus: "pending_official_validation",
		observedAt: "2026-04-25T00:00:00.000Z",
		validationNotes:
			"Live Idealista candidate captured for operator validation against official Catastro before rollout widening.",
	},
	{
		fixtureId: "live-valencia-pintor-stolz-110604052",
		layer: "live_link_regression",
		sourceUrl: "https://www.idealista.com/inmueble/110604052/",
		expectedStatus: "building_match",
		territoryAdapter: "state_catastro",
		humanUnitResolvable: false,
		expectedLocationHint: {
			street: "Calle de Pintor Stolz",
			city: "Valencia",
			stateOrProvince: "Valencia",
			country: "Spain",
		},
		validationStatus: "pending_official_validation",
		observedAt: "2026-04-25T00:00:00.000Z",
		validationNotes:
			"Live Idealista candidate captured for operator validation against official Catastro before rollout widening.",
	},
	{
		fixtureId: "live-getxo-rojo-aldapa-110383879",
		layer: "live_link_regression",
		sourceUrl: "https://www.idealista.com/inmueble/110383879/",
		expectedStatus: "needs_confirmation",
		territoryAdapter: "bizkaia_catastro",
		humanUnitResolvable: false,
		expectedLocationHint: {
			street: "Poligono Rojo-Aldapa",
			city: "Getxo",
			stateOrProvince: "Bizkaia",
			country: "Spain",
		},
		validationStatus: "pending_official_validation",
		observedAt: "2026-04-25T00:00:00.000Z",
		validationNotes:
			"Live Idealista candidate captured for operator validation against official Bizkaia cadastre before rollout widening.",
	},
];

const isBuildingOrBetter = (status: ResolveIdealistaLocationStatus) =>
	status === "exact_match" || status === "building_match";

const roundRate = (numerator: number, denominator: number) =>
	denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 10_000 : 0;

export const getLocalizaGoldenFrozenSummary = () => {
	const hiddenAddressFixtures = localizaGoldenFrozenFixtures.filter(
		(fixture) => fixture.hiddenAddress,
	);
	const humanUnitResolvableFixtures = localizaGoldenFrozenFixtures.filter(
		(fixture) => fixture.humanUnitResolvable,
	);
	const hiddenBuildingOrBetterCount = hiddenAddressFixtures.filter((fixture) =>
		isBuildingOrBetter(fixture.officialResolution.status),
	).length;
	const humanUnitExactCount = humanUnitResolvableFixtures.filter(
		(fixture) => fixture.officialResolution.status === "exact_match",
	).length;

	return {
		fixtureCount: localizaGoldenFrozenFixtures.length,
		territories: Array.from(
			new Set(
				localizaGoldenFrozenFixtures.map(
					(fixture) => fixture.officialResolution.territoryAdapter,
				),
			),
		).sort(),
		hiddenAddressFixtureCount: hiddenAddressFixtures.length,
		humanUnitResolvableFixtureCount: humanUnitResolvableFixtures.length,
		hiddenBuildingOrBetterRate: roundRate(
			hiddenBuildingOrBetterCount,
			hiddenAddressFixtures.length,
		),
		humanUnitExactRate: roundRate(
			humanUnitExactCount,
			humanUnitResolvableFixtures.length,
		),
		liveFixtureCount: localizaGoldenLiveFixtures.length,
		liveOfficiallyValidatedFixtureCount: localizaGoldenLiveFixtures.filter(
			(fixture) => fixture.validationStatus === "officially_validated",
		).length,
		livePendingValidationFixtureCount: localizaGoldenLiveFixtures.filter(
			(fixture) => fixture.validationStatus === "pending_official_validation",
		).length,
	};
};

export const getLocalizaGoldenFrozenContractIssues = () => {
	const summary = getLocalizaGoldenFrozenSummary();
	const issues: string[] = [];

	if (summary.fixtureCount < LOCALIZA_GOLDEN_MIN_FIXTURE_COUNT) {
		issues.push("localiza_golden_fixture_count_below_minimum");
	}

	if (
		summary.hiddenBuildingOrBetterRate < LOCALIZA_GOLDEN_BUILDING_OR_BETTER_RATE
	) {
		issues.push("localiza_hidden_address_building_rate_below_threshold");
	}

	if (summary.humanUnitExactRate < LOCALIZA_GOLDEN_HUMAN_UNIT_EXACT_RATE) {
		issues.push("localiza_human_unit_exact_rate_below_threshold");
	}

	return issues;
};

export const getLocalizaGoldenReadinessIssues = () => {
	const issues = [...getLocalizaGoldenFrozenContractIssues()];

	if (localizaGoldenLiveFixtures.length === 0) {
		issues.push("localiza_live_regression_set_missing");
	}

	if (
		localizaGoldenLiveFixtures.some(
			(fixture) => fixture.validationStatus !== "officially_validated",
		)
	) {
		issues.push("localiza_live_regression_set_pending_official_validation");
	}

	return issues;
};
