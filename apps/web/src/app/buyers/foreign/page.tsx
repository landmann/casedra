import type { Metadata } from "next";

import { BuyerPage } from "../BuyerPage";
import { getBuyerPage } from "../buyer-content";

export const metadata: Metadata = {
	title: "Pack para comprador extranjero en Madrid | Casedra",
	description:
		"NIE, impuestos, financiación y comprobaciones oficiales para compradores internacionales en Madrid.",
};

export default function ForeignBuyerPage() {
	return <BuyerPage page={getBuyerPage("foreign")} />;
}
