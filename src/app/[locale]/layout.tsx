import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ToastProvider } from "@/components/ui/toast";
import { routing } from "@/i18n/routing";

import "../globals.css";

// Display: geométrica y de alto contraste para títulos y marcadores (§7).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// UI/cuerpo: Inter, por legibilidad en tablas densas y pantallas chicas (§7).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brand" });

  return {
    title: { default: `${t("name")} — ${t("tagline")}`, template: `%s · ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "black-translucent" },
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0B0D12",
  // Sin bloqueo de zoom: limitar el pellizco rompe la accesibilidad en móvil,
  // y esta app se usa mayormente desde el celular.
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Habilita el renderizado estático de las rutas que no dependen del usuario.
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-dvh bg-base text-ink antialiased">
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
