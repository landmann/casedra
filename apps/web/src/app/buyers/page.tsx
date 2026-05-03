import type { Metadata } from "next";

import { BuyerPage } from "./BuyerPage";
import { getBuyerPage } from "./buyer-content";

export const metadata: Metadata = {
	title: "Informe del Comprador | Casedra",
	description:
		"Recibe el Informe del Comprador de Casedra y pregunta por anuncios de Madrid antes de pujar.",
};

export default function BuyersPage() {
	return <BuyerPage page={getBuyerPage("main")} />;
}
