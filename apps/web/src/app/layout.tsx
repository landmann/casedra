import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { cn } from "@casedra/ui";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const fontSans = Geist({
	variable: "--font-sans",
	subsets: ["latin"],
});

const fontMono = Geist_Mono({
	variable: "--font-mono",
	subsets: ["latin"],
});

const fontSerif = Instrument_Serif({
	variable: "--font-serif",
	subsets: ["latin"],
	weight: "400",
	style: ["normal", "italic"],
});

export const metadata: Metadata = {
	title: "Casedra",
	description:
		"Casedra ayuda a agencias inmobiliarias a responder antes, repartir mejor y demostrar el trabajo hecho.",
	icons: {
		icon: "/favicon.svg",
		shortcut: "/favicon.svg",
		apple: "/favicon.svg",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="es" suppressHydrationWarning>
			<body
				suppressHydrationWarning
				className={cn(
					"min-h-screen bg-background font-sans text-foreground",
					fontSans.variable,
					fontMono.variable,
					fontSerif.variable,
				)}
			>
				<ClerkProvider signInUrl="/sign-in" localization={esES}>
					<Providers>{children}</Providers>
				</ClerkProvider>
			</body>
		</html>
	);
}
