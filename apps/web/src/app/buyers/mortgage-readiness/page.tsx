import type { Metadata } from "next";

import { BuyerPage } from "../BuyerPage";
import { getBuyerPage } from "../buyer-content";

export const metadata: Metadata = {
	title: "Preparación hipotecaria en Madrid | Casedra",
	description:
		"Prepara presupuesto, hipótesis hipotecarias y comprobaciones antes de hacer una oferta en Madrid.",
};

export default function MortgageReadinessBuyerPage() {
	return <BuyerPage page={getBuyerPage("mortgage-readiness")} />;
}
