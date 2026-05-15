import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { cn } from "@casedra/ui";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const casedraClerkLocalization = {
	...esES,
	organizationList: {
		...esES.organizationList,
		subtitle: "para acceder a Casedra",
		title: "Elige una cuenta",
	},
	signIn: {
		...esES.signIn,
		backupCodeMfa: {
			...esES.signIn?.backupCodeMfa,
			subtitle: "para acceder a Casedra",
		},
		emailCode: {
			...esES.signIn?.emailCode,
			subtitle: "para acceder a Casedra",
			title: "Revisa tu correo",
		},
		emailCodeMfa: {
			...esES.signIn?.emailCodeMfa,
			subtitle: "para acceder a Casedra",
			title: "Revisa tu correo",
		},
		emailLink: {
			...esES.signIn?.emailLink,
			subtitle: "para acceder a Casedra",
			title: "Revisa tu correo",
		},
		emailLinkMfa: {
			...esES.signIn?.emailLinkMfa,
			subtitle: "para acceder a Casedra",
			title: "Revisa tu correo",
		},
		password: {
			...esES.signIn?.password,
			subtitle: "para acceder a Casedra",
			title: "Introduce tu contraseña",
		},
		phoneCode: {
			...esES.signIn?.phoneCode,
			subtitle: "para acceder a Casedra",
		},
		start: {
			...esES.signIn?.start,
			subtitle: "para acceder a Casedra",
			subtitleCombined: "para acceder a Casedra",
			title: "Iniciar sesión",
			titleCombined: "Iniciar sesión",
		},
	},
	signUp: {
		...esES.signUp,
		continue: {
			...esES.signUp?.continue,
			subtitle: "para acceder a Casedra",
		},
		emailCode: {
			...esES.signUp?.emailCode,
			subtitle: "para acceder a Casedra",
			title: "Verifica tu correo",
		},
		emailLink: {
			...esES.signUp?.emailLink,
			subtitle: "para acceder a Casedra",
			title: "Verifica tu correo",
		},
		phoneCode: {
			...esES.signUp?.phoneCode,
			subtitle: "para acceder a Casedra",
		},
		start: {
			...esES.signUp?.start,
			subtitle: "para acceder a Casedra",
			subtitleCombined: "para acceder a Casedra",
		},
	},
};

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
				<ClerkProvider
					signInUrl="/sign-in"
					localization={casedraClerkLocalization}
				>
					<Providers>{children}</Providers>
				</ClerkProvider>
			</body>
		</html>
	);
}
