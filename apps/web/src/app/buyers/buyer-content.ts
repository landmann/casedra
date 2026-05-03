export type BuyerPageKey =
	| "main"
	| "foreign"
	| "hidden-address"
	| "mortgage-readiness"
	| "investors";

type LocalizedCopy = {
	eyebrow: string;
	title: string;
	intro: string;
	brief: string;
	questionPrompt: string;
	signupLead: string;
	propertyLead: string;
	points: string[];
};

export type BuyerPageContent = {
	key: BuyerPageKey;
	path: string;
	signal:
		| "search_intent"
		| "mortgage_readiness"
		| "foreign_buyer"
		| "rental_fatigue"
		| "investor"
		| "hidden_address"
		| "area_heat"
		| "unknown";
	icon: "banknote" | "building" | "file" | "globe" | "home";
	copy: {
		es: LocalizedCopy;
	};
};

export const buyerPages: Record<BuyerPageKey, BuyerPageContent> = {
	main: {
		key: "main",
		path: "/buyers",
		signal: "search_intent",
		icon: "home",
		copy: {
			es: {
				eyebrow: "Informe del Comprador Madrid",
				title: "Compra con hechos antes de pujar.",
				intro:
					"Un informe para compradores que quieren separar presión real, precio defendible y riesgo oculto antes de tomar una decisión grande.",
				brief:
					"Recibe una lectura breve de mercado, financiación y comprobaciones oficiales.",
				questionPrompt:
					"Envíanos un anuncio y te diremos qué conviene verificar primero.",
				signupLead: "Recibe el Informe del Comprador",
				propertyLead: "Pregunta por una propiedad",
				points: ["Precio pedido no es precio cerrado", "Fuentes oficiales primero", "Sin spam ni listas compradas"],
			},
		},
	},
	foreign: {
		key: "foreign",
		path: "/buyers/foreign",
		signal: "foreign_buyer",
		icon: "globe",
		copy: {
			es: {
				eyebrow: "Compradores internacionales",
				title: "Madrid exige pruebas, no intuición remota.",
				intro:
					"NIE, impuestos, financiación, barrio y comprobaciones oficiales explicados para compradores que no pueden visitar todo en persona.",
				brief: "Recibe la guía práctica para comprar desde fuera sin confiar a ciegas en un anuncio.",
				questionPrompt: "Comparte el enlace de la vivienda y tu situación de compra.",
				signupLead: "Recibir el pack internacional",
				propertyLead: "Revisar un anuncio",
				points: ["NIE y financiación", "Impuestos y costes", "Errores comunes al comprar a distancia"],
			},
		},
	},
	"hidden-address": {
		key: "hidden-address",
		path: "/buyers/hidden-address",
		signal: "hidden_address",
		icon: "file",
		copy: {
			es: {
				eyebrow: "Anuncios sin dirección",
				title: "Si la dirección falta, cambia la carga de prueba.",
				intro:
					"Una vivienda puede merecer atención aunque oculte la dirección, pero no merece una oferta sin saber qué se puede verificar.",
				brief: "Recibe la guía de comprobaciones para anuncios con dirección oculta.",
				questionPrompt: "Pega el anuncio oculto y cuéntanos qué te preocupa.",
				signupLead: "Recibir la guía",
				propertyLead: "Comprobar un anuncio oculto",
				points: ["Qué sí se puede inferir", "Qué exige dirección exacta", "Cómo pedir evidencia"],
			},
		},
	},
	"mortgage-readiness": {
		key: "mortgage-readiness",
		path: "/buyers/mortgage-readiness",
		signal: "mortgage_readiness",
		icon: "banknote",
		copy: {
			es: {
				eyebrow: "Preparación hipotecaria",
				title: "La mejor oferta empieza antes de la visita.",
				intro:
					"Compara precio, entrada, FEIN, Euribor, coste total y margen de negociación antes de perseguir la vivienda equivocada.",
				brief: "Recibe el informe para comprar con financiación preparada.",
				questionPrompt: "Envíanos una vivienda, presupuesto y horizonte de compra.",
				signupLead: "Preparar mi compra",
				propertyLead: "Evaluar con mi presupuesto",
				points: ["Coste mensual real", "Entrada y gastos", "Rango para negociar"],
			},
		},
	},
	investors: {
		key: "investors",
		path: "/buyers/investors",
		signal: "investor",
		icon: "building",
		copy: {
			es: {
				eyebrow: "Compradores inversores",
				title: "Compra números que aguanten supuestos conservadores.",
				intro:
					"Rentabilidad, regulación, reforma, liquidez y riesgo de inquilino importan más que un precio por metro aislado.",
				brief: "Recibe la lectura para inversores de Madrid.",
				questionPrompt: "Comparte la vivienda y tus hipótesis de alquiler o reforma.",
				signupLead: "Recibir la lectura de inversión",
				propertyLead: "Analizar una inversión",
				points: ["Renta vs hipoteca", "Riesgo regulatorio", "Liquidez y reforma"],
			},
		},
	},
};

export const getBuyerPage = (key: BuyerPageKey) => buyerPages[key];

export const intentClusters = [
	"comprar piso madrid",
	"comprar vivienda Madrid",
	"anuncio sin dirección Idealista",
	"hipoteca Madrid no residente",
	"alquilar o comprar Madrid",
] as const;
