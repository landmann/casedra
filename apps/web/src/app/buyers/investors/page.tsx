import type { Metadata } from "next";

import { BuyerPage } from "../BuyerPage";
import { getBuyerPage } from "../buyer-content";

export const metadata: Metadata = {
	title: "Lectura para inversores en Madrid | Casedra",
	description:
		"Evalúa inversiones inmobiliarias en Madrid con alquiler, hipoteca, regulación, reforma y liquidez.",
};

export default function InvestorBuyerPage() {
	return <BuyerPage page={getBuyerPage("investors")} />;
}
