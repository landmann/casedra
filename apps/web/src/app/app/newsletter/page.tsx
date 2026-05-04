"use client";

import { Button, cn, Input, Textarea } from "@casedra/ui";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Mail,
  MapPin,
  Newspaper,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@casedra/api/convex";
import { useMutation, useQuery } from "convex/react";
import { capturePosthogEvent } from "@/lib/posthog";
import type { Id } from "../../../../../../convex/_generated/dataModel";

type CityKey = "madrid" | "barcelona" | "valencia" | "malaga";
type AudienceKey =
  | "sellers"
  | "buyers"
  | "investors"
  | "landlords"
  | "pastClients";
type NewsletterAudience =
  | "sellers"
  | "buyers"
  | "investors"
  | "landlords"
  | "past_clients";
type DraftStatus = "draft" | "ready" | "archived";

type SourceLink = {
  label: string;
  url: string;
  description: string;
};

type MarketCity = {
  key: CityKey;
  label: string;
  region: string;
  salePrice: string;
  saleMonthly: string;
  saleAnnual: string;
  rentPrice: string;
  regionalSalesYoY: string;
  transactionPulse: string;
  supplyPulse: string;
  localSignals: string[];
  watchouts: string[];
  sources: SourceLink[];
};

type AudienceProfile = {
  key: AudienceKey;
  label: string;
  shortLabel: string;
  icon: typeof UsersRound;
  brief: string;
  primaryQuestion: string;
  trustMove: string;
  cta: string;
  angle: string;
};

const cities: MarketCity[] = [
  {
    key: "madrid",
    label: "Madrid",
    region: "Comunidad de Madrid",
    salePrice: "5.960 €/m²",
    saleMonthly: "+0,8%",
    saleAnnual: "+12,0%",
    rentPrice: "23,2 €/m²",
    regionalSalesYoY: "-3,0%",
    transactionPulse:
      "Las compraventas registradas bajaron ligeramente en la región en febrero; conviene hablar de precio defendible y no de urgencia.",
    supplyPulse:
      "La oferta publicada está en máximo histórico de precio, con distritos centrales todavía tensionados.",
    localSignals: [
      "Arganzuela y Barajas aparecen como distritos con fuerte tracción anual.",
      "El coste de esperar pesa: alquiler y compra se mantienen caros a la vez.",
      "Los compradores comparan financiación, barrio y reforma con más disciplina.",
    ],
    watchouts: [
      "No convertir subidas de oferta en promesa de precio cerrado.",
      "Separar vivienda lista para entrar de activos con obra pendiente.",
    ],
    sources: [
      {
        label: "idealista venta Madrid",
        url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/venta/madrid-comunidad/madrid-provincia/madrid/",
        description: "Precio de oferta, variación mensual y anual.",
      },
      {
        label: "idealista alquiler Madrid",
        url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/alquiler/madrid-comunidad/madrid-provincia/madrid/",
        description: "Presión de alquiler y coste de espera.",
      },
    ],
  },
  {
    key: "barcelona",
    label: "Barcelona",
    region: "Cataluña",
    salePrice: "5.176 €/m²",
    saleMonthly: "+0,6%",
    saleAnnual: "+7,7%",
    rentPrice: "22,6 €/m²",
    regionalSalesYoY: "+5,7%",
    transactionPulse:
      "Las compraventas registradas crecieron en Cataluña en febrero, pero las decisiones se apoyan más en barrio, estado legal y coste total.",
    supplyPulse:
      "El alquiler sigue siendo una referencia clave para propietarios e inversores por el peso regulatorio.",
    localSignals: [
      "La subida anual es más templada que Madrid o Málaga, pero sigue por encima de inflación normalizada.",
      "El comprador exige claridad sobre comunidad, ITE, eficiencia y derramas.",
      "La regulación de alquiler debe tratarse como parte del análisis, no como nota al pie.",
    ],
    watchouts: [
      "Evitar titulares de escasez sin explicar barrio y tipología.",
      "No mezclar rentabilidad bruta con caja neta después de gastos.",
    ],
    sources: [
      {
        label: "idealista venta Barcelona",
        url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/venta/cataluna/barcelona-provincia/barcelona/",
        description: "Precio de oferta y evolución publicada.",
      },
      {
        label: "idealista alquiler Barcelona",
        url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/alquiler/cataluna/barcelona-provincia/barcelona/",
        description: "Señal de tensión en alquiler residencial.",
      },
    ],
  },
  {
    key: "valencia",
    label: "València",
    region: "Comunitat Valenciana",
    salePrice: "3.339 €/m²",
    saleMonthly: "0,0%",
    saleAnnual: "+14,4%",
    rentPrice: "16,4 €/m²",
    regionalSalesYoY: "-4,7%",
    transactionPulse:
      "La región mostró menos compraventas registradas en febrero; la pausa mensual de precio no basta para llamar cambio de ciclo.",
    supplyPulse:
      "La renta publicada se modera en el mes, aunque continúa por encima del año anterior.",
    localSignals: [
      "Benicalap y Algirós muestran presión anual por encima de la media local.",
      "El mensaje útil es calma táctica: no perseguir cualquier precio, sí preparar bien la decisión.",
      "Los clientes valoran comparables recientes y explicación de microzona.",
    ],
    watchouts: [
      "No vender el 0,0% mensual como cambio de ciclo.",
      "Aclarar que precio pedido y precio escriturado no son lo mismo.",
    ],
    sources: [
      {
        label: "idealista venta València",
        url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/venta/comunitat-valenciana/valencia-valencia/valencia/",
        description: "Precio de oferta, barrios y serie mensual.",
      },
      {
        label: "idealista alquiler València",
        url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/alquiler/comunitat-valenciana/valencia-valencia/valencia/",
        description: "Alquiler publicado y evolución mensual.",
      },
    ],
  },
  {
    key: "malaga",
    label: "Málaga",
    region: "Andalucía",
    salePrice: "3.720 €/m²",
    saleMonthly: "+1,5%",
    saleAnnual: "+12,1%",
    rentPrice: "16,2 €/m²",
    regionalSalesYoY: "+2,8%",
    transactionPulse:
      "Andalucía siguió en positivo en compraventas registradas de febrero; el filtro debe ser calidad de activo, no demanda genérica.",
    supplyPulse:
      "El precio publicado marca máximo, así que la confianza depende de explicar qué inmuebles justifican prima.",
    localSignals: [
      "Carretera de Cádiz y Bailén - Miraflores aparecen con señales de avance reciente.",
      "La conversación de inversión debe separar uso residencial, temporada y alquiler de larga estancia.",
      "Para familias, la presión se traduce en preparar financiación y negociar rápido solo cuando el activo encaja.",
    ],
    watchouts: [
      "No presentar demanda turística como seguridad para cualquier compra.",
      "Revisar licencia, comunidad y uso permitido antes de prometer rentabilidad.",
    ],
    sources: [
      {
        label: "idealista venta Málaga",
        url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/venta/andalucia/malaga-provincia/malaga/",
        description: "Precio de oferta y distritos destacados.",
      },
      {
        label: "idealista alquiler Málaga",
        url: "https://www.idealista.com/sala-de-prensa/informes-precio-vivienda/alquiler/andalucia/malaga-provincia/malaga/",
        description: "Referencia de alquiler publicado.",
      },
    ],
  },
];

const nationalSources: SourceLink[] = [
  {
    label: "INE ETDP",
    url: "https://www.ine.es/dyngs/Prensa/en/ETDP0226.htm",
    description: "Compraventas registradas de febrero 2026 por CCAA.",
  },
  {
    label: "INE Hipotecas",
    url: "https://www.ine.es/dyngs/Prensa/en/H0226.htm",
    description: "Hipotecas sobre vivienda de febrero 2026.",
  },
  {
    label: "Banco de España",
    url: "https://www.bde.es/webbe/en/estadisticas/compartido/calendario/pdf/calendario-bde-2026e.pdf",
    description: "Calendario de tipos, Euribor e indicadores hipotecarios.",
  },
  {
    label: "SERPAVI",
    url: "https://publicaciones.transportes.gob.es/serpavi-2026-sistema-estatal-de-referencia-del-precio-del-alquiler-de-vivienda",
    description: "Índice estatal de referencia para alquiler residencial.",
  },
];

const audiences: AudienceProfile[] = [
  {
    key: "sellers",
    label: "Propietarios vendedores",
    shortLabel: "Vendedores",
    icon: TrendingUp,
    brief:
      "Quieren saber si este mes justifica salir a mercado, ajustar precio o esperar.",
    primaryQuestion: "¿Qué precio puedo defender sin quemar la vivienda?",
    trustMove:
      "Dar un rango, explicar qué comparables lo sostienen y admitir dónde falta evidencia.",
    cta: "pedirme una valoración con comparables de tu portal y tu calle",
    angle:
      "El mercado premia viviendas bien preparadas; el precio inicial sigue siendo la primera negociación.",
  },
  {
    key: "buyers",
    label: "Compradores activos",
    shortLabel: "Compradores",
    icon: Target,
    brief:
      "Necesitan distinguir presión real de ruido para no precipitar una compra mala.",
    primaryQuestion: "¿Dónde merece la pena moverse rápido y dónde negociar?",
    trustMove:
      "Traducir datos a presupuesto mensual, coste de reforma y margen de negociación.",
    cta: "enviarme tu presupuesto y zonas favoritas para filtrar oportunidades",
    angle:
      "Comprar bien este mes exige preaprobación, comparables y una lista corta de barrios, no ansiedad.",
  },
  {
    key: "investors",
    label: "Inversores",
    shortLabel: "Inversores",
    icon: BarChart3,
    brief:
      "Buscan rendimiento neto, riesgo regulatorio y liquidez de salida, no solo precio por metro.",
    primaryQuestion:
      "¿La renta compensa precio, gastos, regulación y vacancia?",
    trustMove:
      "Mostrar rentabilidad como rango neto y separar alquiler estable de hipótesis turística.",
    cta: "pedirme un análisis de caja neta antes de reservar",
    angle:
      "La ventaja no está en comprar lo popular, sino en comprar lo que aguanta números conservadores.",
  },
  {
    key: "landlords",
    label: "Arrendadores",
    shortLabel: "Arrendadores",
    icon: ShieldCheck,
    brief:
      "Quieren proteger renta, cumplimiento y calidad de inquilino sin exponerse a errores legales.",
    primaryQuestion: "¿Debo actualizar renta, reformar o cambiar estrategia?",
    trustMove:
      "Hablar de rango legal, estado de la vivienda y perfil de demanda antes de prometer subida.",
    cta: "revisar tu contrato y el rango de mercado antes de tomar decisiones",
    angle:
      "El mejor alquiler combina precio defendible, vivienda presentable y contrato bien documentado.",
  },
  {
    key: "pastClients",
    label: "Clientes anteriores",
    shortLabel: "Clientes",
    icon: UsersRound,
    brief:
      "Necesitan una lectura simple para decidir si mover ficha, refinanciar, alquilar o simplemente vigilar.",
    primaryQuestion: "¿Qué significa esto para mi patrimonio?",
    trustMove:
      "Dar contexto sin vender de más: una recomendación útil, una alerta y una invitación concreta.",
    cta: "contarme si quieres que actualice el valor estimado de tu vivienda",
    angle:
      "El valor de una vivienda no se mira solo al vender; conviene revisarlo cuando cambia el mercado.",
  },
];

const sharedBriefPoints = [
  "El precio publicado mide oferta viva, no cierre notarial.",
  "Las compraventas registradas llegan con retraso, pero corrigen el exceso de optimismo de los portales.",
  "Tipos, alquiler y regulación cambian la decisión tanto como el precio por metro.",
];

const freshnessNote =
  "Fuentes revisadas el 3 may 2026: precios publicados de marzo 2026, ETDP e hipotecas de febrero 2026 y calendario financiero de abril 2026.";

const getCity = (key: CityKey) =>
  cities.find((city) => city.key === key) ?? cities[0];

const isCityKey = (value: string): value is CityKey =>
  cities.some((city) => city.key === value);

const getAudience = (key: AudienceKey) =>
  audiences.find((audience) => audience.key === key) ?? audiences[0];

const toNewsletterAudience = (key: AudienceKey): NewsletterAudience =>
  key === "pastClients" ? "past_clients" : key;

const fromNewsletterAudience = (key: NewsletterAudience): AudienceKey =>
  key === "past_clients" ? "pastClients" : key;

const getDraftStatusLabel = (status: DraftStatus) => {
  switch (status) {
    case "ready":
      return "Listo, no enviado";
    case "archived":
      return "Archivado";
    default:
      return "Borrador, no enviado";
  }
};

const buildGeneratedCopy = (
  city: MarketCity,
  audience: AudienceProfile,
  variant: number,
) => {
  const opener =
    variant % 2 === 0
      ? `Este mes, ${city.label} sigue siendo un mercado exigente, pero no todas las señales dicen lo mismo.`
      : `La lectura útil de ${city.label} no es "sube o baja"; es dónde hay presión real y dónde conviene negociar.`;

  const subject = `${city.label}: lectura de mercado para ${audience.shortLabel.toLowerCase()}`;
  const preheader = `${city.salePrice}, ${city.saleMonthly} mensual y lo que significa para decidir con calma.`;
  const body = [
    `Hola,`,
    `${opener} La oferta publicada se sitúa en ${city.salePrice}, con una variación mensual de ${city.saleMonthly} y una evolución anual de ${city.saleAnnual}. En alquiler, la referencia publicada ronda ${city.rentPrice}.`,
    `En los datos oficiales regionales, las compraventas registradas se movieron ${city.regionalSalesYoY} interanual en febrero. Para ${audience.shortLabel.toLowerCase()}, la pregunta práctica es: ${audience.primaryQuestion.toLowerCase()} ${audience.angle}`,
    `Mi recomendación es mirar tres cosas antes de decidir: comparables recientes de la misma microzona, coste financiero real y estado de la vivienda. ${city.transactionPulse}`,
    `También conviene ser transparente con los límites: el precio de portal no equivale al precio de cierre, y los datos oficiales llegan con retraso. Por eso cruzo portales, registros y financiación antes de recomendar un precio o una oferta.`,
    `Si estás valorando una decisión en ${city.label}, puedes ${audience.cta}. Te diré qué parte del mercado juega a tu favor y qué parte todavía hay que comprobar.`,
    `Un abrazo,`,
  ].join("\n\n");

  return { subject, preheader, body };
};

function MetricBlock({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="p-4 sm:p-5">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-normal leading-none tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SelectionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-[background-color,color,box-shadow,transform] active:scale-[0.96]",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const getCopyButtonLabel = (status: "idle" | "copied" | "failed") => {
  switch (status) {
    case "copied":
      return "Copiado";
    case "failed":
      return "No se pudo copiar";
    default:
      return "Copiar";
  }
};

export default function NewsletterPage() {
  const [selectedCity, setSelectedCity] = useState<CityKey>("madrid");
  const [selectedAudience, setSelectedAudience] =
    useState<AudienceKey>("buyers");
  const [variant, setVariant] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [currentDraftId, setCurrentDraftId] =
    useState<Id<"newsletterDrafts"> | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("draft");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [launchDraftsEnsured, setLaunchDraftsEnsured] = useState(false);
  const loadingDraftRef = useRef(false);
  const drafts = useQuery(api.newsletter.listDrafts, {});
  const overview = useQuery(api.newsletter.getOutboundOverview, {});
  const saveDraft = useMutation(api.newsletter.saveDraft);
  const ensureLaunchDrafts = useMutation(api.newsletter.ensureLaunchBuyerBriefDrafts);

  const city = getCity(selectedCity);
  const audience = getAudience(selectedAudience);
  const generated = useMemo(
    () => buildGeneratedCopy(city, audience, variant),
    [city, audience, variant],
  );
  const [subject, setSubject] = useState(generated.subject);
  const [preheader, setPreheader] = useState(generated.preheader);
  const [emailBody, setEmailBody] = useState(generated.body);

  useEffect(() => {
    if (loadingDraftRef.current) {
      loadingDraftRef.current = false;
      return;
    }
    setSubject(generated.subject);
    setPreheader(generated.preheader);
    setEmailBody(generated.body);
    setCopyStatus("idle");
    setSaveStatus("idle");
    setCurrentDraftId(null);
    setDraftStatus("draft");
  }, [generated]);

  useEffect(() => {
    if (launchDraftsEnsured) {
      return;
    }
    setLaunchDraftsEnsured(true);
    void ensureLaunchDrafts({});
  }, [ensureLaunchDrafts, launchDraftsEnsured]);

  const allSources = [...city.sources, ...nationalSources];
  const sourceNames = allSources.map((source) => source.label).join(", ");
  const composedEmail = `Asunto: ${subject}\nEntradilla: ${preheader}\n\n${emailBody}\n\nFuentes revisadas: ${sourceNames}`;
  const copyButtonLabel = getCopyButtonLabel(copyStatus);
  const CopyStatusIcon = copyStatus === "copied" ? ClipboardCheck : Copy;
  const sourceSnapshot = allSources.map((source) => ({
    label: source.label,
    url: source.url,
    description: source.description,
  }));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(composedEmail);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };
  const resetCopyStatus = () => {
    setCopyStatus((status) => (status === "idle" ? status : "idle"));
    setSaveStatus((status) => (status === "idle" ? status : "idle"));
  };
  const handleSaveDraft = async (status: DraftStatus = draftStatus) => {
    setSaveStatus("saving");
    try {
      const draftId = await saveDraft({
        draftId: currentDraftId ?? undefined,
        market: selectedCity,
        audience: toNewsletterAudience(selectedAudience),
        title: subject.trim() || `${city.label} Informe del Comprador`,
        subject,
        preheader,
        body: emailBody,
        sourceSnapshot,
        status,
      });
      setCurrentDraftId(draftId);
      setDraftStatus(status);
      setSaveStatus("saved");
      capturePosthogEvent("buyer_brief_draft_saved", {
        market: selectedCity,
        audience: toNewsletterAudience(selectedAudience),
        status,
      });
    } catch {
      setSaveStatus("failed");
    }
  };
  const handleExport = () => {
    const blob = new Blob([composedEmail], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "informe-del-comprador"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    capturePosthogEvent("buyer_brief_draft_exported", {
      market: selectedCity,
      audience: toNewsletterAudience(selectedAudience),
    });
  };
  const loadDraft = (draft: NonNullable<typeof drafts>[number]) => {
    loadingDraftRef.current = true;
    setSelectedCity(isCityKey(draft.market) ? draft.market : "madrid");
    setSelectedAudience(fromNewsletterAudience(draft.audience as NewsletterAudience));
    setSubject(draft.subject);
    setPreheader(draft.preheader);
    setEmailBody(draft.body);
    setDraftStatus(draft.status as DraftStatus);
    setCurrentDraftId(draft._id);
    setCopyStatus("idle");
    setSaveStatus("idle");
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase text-muted-foreground">
              <Newspaper
                className="h-3.5 w-3.5 text-primary"
                aria-hidden="true"
              />
              Investigación mensual
            </div>
            <h1 className="mt-3 max-w-3xl text-balance font-serif text-[2.8rem] font-normal leading-[0.95] sm:text-[4.5rem]">
              Informe del Comprador
            </h1>
          </div>
          <div className="max-w-xl text-sm leading-6 text-muted-foreground">
            <p>
              Redacción del Informe del Comprador con fuentes trazables.
              Casedra guarda, copia y exporta borradores aquí; el envío queda
              cerrado hasta activar SES.
            </p>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <MetricBlock
            label="Suscriptores del informe"
            value={String(overview?.buyerSubscriberCount ?? "—")}
            subtitle="Audiencia con consentimiento"
          />
          <MetricBlock
            label="Prueba de consentimiento"
            value={`${overview?.consentProofCoveragePct ?? "—"}%`}
            subtitle="Cobertura de alta y privacidad"
          />
          <MetricBlock
            label="Consultas"
            value={String(overview?.propertyQuestionCount ?? "—")}
            subtitle="Preguntas sobre propiedades"
          />
          <MetricBlock
            label="Borradores guardados"
            value={String(overview?.savedBuyerDraftCount ?? "—")}
            subtitle={`${overview?.readyDraftCount ?? 0} listos, ninguno enviado`}
          />
        </section>

        <section className="rounded-[28px] border border-border/80 bg-background/95 p-3 shadow-[0_18px_60px_rgba(31,26,20,0.06)]">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr_auto] lg:items-center">
            <div
              className="flex flex-wrap gap-2 rounded-full bg-secondary/70 p-1"
              role="group"
              aria-label="Ciudad del informe"
            >
              {cities.map((item) => (
                <SelectionButton
                  key={item.key}
                  active={selectedCity === item.key}
                  onClick={() => setSelectedCity(item.key)}
                >
                  {item.label}
                </SelectionButton>
              ))}
            </div>

            <div
              className="flex flex-wrap gap-2 rounded-full bg-secondary/70 p-1"
              role="group"
              aria-label="Audiencia objetivo"
            >
              {audiences.map((item) => {
                const Icon = item.icon;

                return (
                  <SelectionButton
                    key={item.key}
                    active={selectedAudience === item.key}
                    onClick={() => setSelectedAudience(item.key)}
                  >
                    <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {item.shortLabel}
                  </SelectionButton>
                );
              })}
            </div>

            <Button
              type="button"
              onClick={() => setVariant((value) => value + 1)}
              className="min-h-11 rounded-full px-5 transition-transform active:scale-[0.96]"
            >
              <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Recomponer
            </Button>
          </div>
        </section>

        <section className="border border-border/80 bg-secondary/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase text-muted-foreground">
                Borradores de lanzamiento del Informe del Comprador
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Los tres primeros borradores de la secuencia se preparan para
                esta agencia y pueden cargarse en el editor.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(drafts ?? [])
                .filter((draft) => draft.audience === "buyers" && draft.market === "madrid")
                .slice(0, 6)
                .map((draft) => (
                  <button
                    key={draft._id}
                    type="button"
                    onClick={() => loadDraft(draft)}
                    className={cn(
                      "border border-border bg-background/75 px-3 py-2 text-left text-sm transition-colors hover:text-primary",
                      currentDraftId === draft._id && "border-primary text-primary",
                    )}
                  >
                    <span className="block max-w-[14rem] truncate">{draft.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {getDraftStatusLabel(draft.status as DraftStatus)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[30px] border border-border/80 bg-background/95 shadow-[0_24px_70px_rgba(31,26,20,0.06)]">
            <div className="border-b border-border/70 p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <MapPin
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  {city.region}
                </span>
                <span>Últimos datos disponibles</span>
              </div>
              <h2 className="mt-3 text-balance font-serif text-4xl font-normal leading-tight sm:text-5xl">
                Qué contar en {city.label}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {freshnessNote}
              </p>
            </div>

            <div className="grid divide-y divide-border/70 md:grid-cols-3 md:divide-x md:divide-y-0">
              <MetricBlock
                label="Venta"
                value={city.salePrice}
                subtitle={`${city.saleMonthly} mensual, ${city.saleAnnual} anual`}
              />
              <MetricBlock
                label="Alquiler"
                value={city.rentPrice}
                subtitle="Referencia útil para coste de espera y rendimiento"
              />
              <MetricBlock
                label="Compraventas"
                value={city.regionalSalesYoY}
                subtitle="Variación interanual regional de febrero 2026"
              />
            </div>

            <div className="space-y-7 p-6 sm:p-7">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  Ángulo recomendado
                </div>
                <p className="mt-3 text-pretty text-base leading-7 text-muted-foreground">
                  {audience.angle}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">
                    Señales locales
                  </p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                    {city.localSignals.map((signal) => (
                      <li key={signal} className="flex gap-3">
                        <CheckCircle2
                          className="mt-1 h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span>{signal}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">
                    Cuidado editorial
                  </p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                    {city.watchouts.map((watchout) => (
                      <li key={watchout} className="flex gap-3">
                        <ShieldCheck
                          className="mt-1 h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span>{watchout}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t border-border/70 pt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <UsersRound
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  {audience.label}
                </div>
                <div className="mt-3 grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-3">
                  <p>{audience.brief}</p>
                  <p>{audience.trustMove}</p>
                  <p>{city.supplyPulse}</p>
                </div>
              </div>

              <div className="border-t border-border/70 pt-6">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                  Base de confianza
                </p>
                <ul className="mt-3 grid gap-3 text-sm leading-6 text-muted-foreground md:grid-cols-3">
                  {sharedBriefPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-border/70 pt-6">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                  Fuentes
                </p>
                <div className="mt-3 divide-y divide-border/70">
                  {allSources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:text-primary"
                    >
                      <span>
                        <span className="font-medium text-foreground group-hover:text-primary">
                          {source.label}
                        </span>
                        <span className="mt-1 block leading-6 text-muted-foreground">
                          {source.description}
                        </span>
                      </span>
                      <FileText
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-border/80 bg-background/95 shadow-[0_24px_70px_rgba(31,26,20,0.06)]">
            <div className="flex flex-col gap-4 border-b border-border/70 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase text-muted-foreground">
                  <Mail
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  Borrador del boletín
                </div>
                <h2 className="mt-3 font-serif text-4xl font-normal leading-tight">
                  Informe del Comprador listo para revisar
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {getDraftStatusLabel(draftStatus)}
                  {saveStatus === "saved" ? " · Guardado" : ""}
                  {saveStatus === "failed" ? " · No guardado" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSaveDraft("draft")}
                  disabled={saveStatus === "saving"}
                  className="min-h-11 rounded-full border-border bg-background px-5 text-foreground transition-[background-color,color,transform] active:scale-[0.96]"
                >
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSaveDraft("ready")}
                  disabled={saveStatus === "saving"}
                  className="min-h-11 rounded-full border-border bg-background px-5 text-foreground transition-[background-color,color,transform] active:scale-[0.96]"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Marcar listo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExport}
                  className="min-h-11 rounded-full border-border bg-background px-5 text-foreground transition-[background-color,color,transform] active:scale-[0.96]"
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Exportar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="min-h-11 rounded-full border-border bg-background px-5 text-foreground transition-[background-color,color,transform] active:scale-[0.96]"
                >
                  <CopyStatusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span aria-live="polite">{copyButtonLabel}</span>
                </Button>
              </div>
            </div>

            <div className="space-y-5 p-6 sm:p-7">
              <label className="block">
                <span className="text-[11px] font-medium uppercase text-muted-foreground">
                  Asunto
                </span>
                <Input
                  value={subject}
                  onChange={(event) => {
                    setSubject(event.target.value);
                    resetCopyStatus();
                  }}
                  className="mt-2 min-h-12 rounded-2xl border-border bg-secondary/45 text-base"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium uppercase text-muted-foreground">
                  Entradilla
                </span>
                <Input
                  value={preheader}
                  onChange={(event) => {
                    setPreheader(event.target.value);
                    resetCopyStatus();
                  }}
                  className="mt-2 min-h-12 rounded-2xl border-border bg-secondary/45 text-base"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium uppercase text-muted-foreground">
                  Cuerpo
                </span>
                <Textarea
                  value={emailBody}
                  onChange={(event) => {
                    setEmailBody(event.target.value);
                    resetCopyStatus();
                  }}
                  className="mt-2 min-h-[520px] rounded-[24px] border-border bg-secondary/45 p-5 text-[15px] leading-7"
                />
              </label>

              <div className="grid gap-4 border-t border-border/70 pt-6 text-sm leading-6 text-muted-foreground md:grid-cols-3">
                <div>
                  <p className="font-medium text-foreground">Promesa</p>
                  <p className="mt-1">{audience.primaryQuestion}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Prueba</p>
                  <p className="mt-1">
                    Portales, registros y financiación, no una única cifra.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Acción</p>
                  <p className="mt-1">{audience.cta}.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
