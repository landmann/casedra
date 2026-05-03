import type { Metadata } from "next";

import { BuyerPage } from "../BuyerPage";
import { getBuyerPage } from "../buyer-content";

export const metadata: Metadata = {
	title: "Anuncios sin dirección | Casedra",
	description:
		"Qué comprobar cuando un anuncio de Madrid oculta la dirección exacta.",
};

export default function HiddenAddressBuyerPage() {
	return <BuyerPage page={getBuyerPage("hidden-address")} />;
}
