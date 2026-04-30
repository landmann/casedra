import { getAvailableLocalizaStrategies } from "@/server/localiza/availability";
import LocalizaResolverClient from "./LocalizaResolverClient";

type LocalizaPageProps = {
	searchParams?: Promise<{
		sourceUrl?: string;
	}>;
};

export default async function LocalizaPage({ searchParams }: LocalizaPageProps) {
	const resolvedSearchParams = searchParams ? await searchParams : undefined;

	return (
		<LocalizaResolverClient
			availableLocalizaStrategies={getAvailableLocalizaStrategies()}
			initialSourceUrl={resolvedSearchParams?.sourceUrl ?? ""}
		/>
	);
}
