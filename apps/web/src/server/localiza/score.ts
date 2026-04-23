import type { IdealistaSignals } from "@casedra/types";

import type { LocalizaTerritoryAdapter } from "./types";

const provinceNamesByCode: Record<string, string> = {
  "01": "Alava",
  "02": "Albacete",
  "03": "Alicante",
  "04": "Almeria",
  "05": "Avila",
  "06": "Badajoz",
  "07": "Baleares",
  "08": "Barcelona",
  "09": "Burgos",
  "10": "Caceres",
  "11": "Cadiz",
  "12": "Castellon",
  "13": "Ciudad Real",
  "14": "Cordoba",
  "15": "A Coruna",
  "16": "Cuenca",
  "17": "Girona",
  "18": "Granada",
  "19": "Guadalajara",
  "20": "Gipuzkoa",
  "21": "Huelva",
  "22": "Huesca",
  "23": "Jaen",
  "24": "Leon",
  "25": "Lleida",
  "26": "La Rioja",
  "27": "Lugo",
  "28": "Madrid",
  "29": "Malaga",
  "30": "Murcia",
  "31": "Navarra",
  "32": "Ourense",
  "33": "Asturias",
  "34": "Palencia",
  "35": "Las Palmas",
  "36": "Pontevedra",
  "37": "Salamanca",
  "38": "Santa Cruz de Tenerife",
  "39": "Cantabria",
  "40": "Segovia",
  "41": "Sevilla",
  "42": "Soria",
  "43": "Tarragona",
  "44": "Teruel",
  "45": "Toledo",
  "46": "Valencia",
  "47": "Valladolid",
  "48": "Bizkaia",
  "49": "Zamora",
  "50": "Zaragoza",
  "51": "Ceuta",
  "52": "Melilla",
};

const regionalTerritoryMatchers: Array<{
  adapter: LocalizaTerritoryAdapter;
  aliases: string[];
}> = [
  {
    adapter: "navarra_rtn",
    aliases: ["navarra", "comunidad foral de navarra"],
  },
  {
    adapter: "alava_catastro",
    aliases: ["alava", "araba"],
  },
  {
    adapter: "bizkaia_catastro",
    aliases: ["bizkaia", "vizcaya"],
  },
  {
    adapter: "gipuzkoa_catastro",
    aliases: ["gipuzkoa", "guipuzcoa"],
  },
];

const streetTypeExpansions: Record<string, string> = {
  CL: "Calle",
  CLL: "Calle",
  AV: "Avenida",
  AVDA: "Avenida",
  AVENIDA: "Avenida",
  PZ: "Plaza",
  PLAZA: "Plaza",
  PS: "Paseo",
  PASEO: "Paseo",
  CM: "Camino",
  CAMINO: "Camino",
  CR: "Carretera",
  CTRA: "Carretera",
  CARRETERA: "Carretera",
  RDA: "Ronda",
  RONDA: "Ronda",
  TR: "Travesia",
  TRAVESIA: "Travesia",
  UR: "Urbanizacion",
  URB: "Urbanizacion",
  PG: "Poligono",
};

const titleCaseMinorWords = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "da",
  "do",
  "dos",
]);

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export const normalizeLocalizaText = (value?: string) =>
  stripDiacritics((value ?? "").toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const dedupeStrings = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean)));

export const formatPostalCode = (value?: string) => {
  const digits = (value ?? "").replace(/\D+/g, "");

  if (!digits) {
    return undefined;
  }

  return digits.padStart(5, "0").slice(-5);
};

export const humanizePlaceName = (value?: string) => {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return undefined;
  }

  return normalized
    .toLowerCase()
    .split(/\s+/)
    .map((token, index) => {
      if (index > 0 && titleCaseMinorWords.has(token)) {
        return token;
      }

      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ");
};

export const humanizeStreetName = (value?: string) => {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return undefined;
  }

  const [head, ...rest] = normalized.split(/\s+/);
  const expandedHead = streetTypeExpansions[head.toUpperCase()] ?? head;
  return humanizePlaceName([expandedHead, ...rest].join(" "));
};

export const buildListingSignalCorpus = (signals: IdealistaSignals) =>
  normalizeLocalizaText(
    [
      signals.title,
      signals.listingText,
      signals.portalHint,
      signals.floorText,
      signals.neighborhood,
      signals.municipality,
      signals.province,
      signals.postalCodeHint,
    ]
      .filter(Boolean)
      .join(" ")
  );

export const buildSearchRadii = (mapPrecisionMeters?: number) => {
  const base = Math.min(Math.max(mapPrecisionMeters ?? 35, 20), 120);
  return dedupeNumbers([
    Math.round(base * 0.8),
    Math.round(base * 1.6),
    Math.round(base * 3.2),
  ]).filter((radius) => radius > 0);
};

const dedupeNumbers = (values: number[]) => Array.from(new Set(values));

export const convertWgs84ToWebMercator = (latitude: number, longitude: number) => {
  const clampedLatitude = Math.min(Math.max(latitude, -85.05112878), 85.05112878);
  const x = (longitude * 20037508.34) / 180;
  const y =
    (Math.log(Math.tan(((90 + clampedLatitude) * Math.PI) / 360)) /
      (Math.PI / 180)) *
    (20037508.34 / 180);

  return { x, y };
};

export const distanceBetweenPoints = (
  left: { x: number; y: number },
  right: { x: number; y: number }
) => Math.hypot(left.x - right.x, left.y - right.y);

export const getProvinceNameFromCode = (provinceCode?: string) =>
  provinceCode ? provinceNamesByCode[provinceCode] : undefined;

export const provinceMatchesHint = (
  provinceCode: string | undefined,
  provinceHint: string | undefined
) => {
  if (!provinceHint) {
    return true;
  }

  const candidateProvince = normalizeLocalizaText(
    getProvinceNameFromCode(provinceCode)
  );
  const normalizedHint = normalizeLocalizaText(provinceHint);

  if (!candidateProvince || !normalizedHint) {
    return false;
  }

  return candidateProvince === normalizedHint;
};

export const detectRegionalTerritory = (provinceHint?: string) => {
  const normalizedProvince = normalizeLocalizaText(provinceHint);

  if (!normalizedProvince) {
    return null;
  }

  return (
    regionalTerritoryMatchers.find((territory) =>
      territory.aliases.some((alias) => normalizeLocalizaText(alias) === normalizedProvince)
    )?.adapter ?? null
  );
};

export const corpusIncludesPhrase = (corpus: string, phrase?: string) => {
  const normalizedPhrase = normalizeLocalizaText(phrase);

  if (!corpus || !normalizedPhrase) {
    return false;
  }

  return corpus.includes(normalizedPhrase);
};

export const corpusIncludesDesignator = (corpus: string, designator?: string) => {
  const normalizedDesignator = normalizeLocalizaText(designator);

  if (!corpus || !normalizedDesignator) {
    return false;
  }

  const paddedCorpus = ` ${corpus} `;
  return paddedCorpus.includes(` ${normalizedDesignator} `);
};
