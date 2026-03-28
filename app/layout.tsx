import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import OSSActivity from "@/components/oss-activity";
import Profile from "@/components/profile";
import { Sidebar } from "@/components/sidebar";
import Footer from "@/components/footer";
import { personConfig } from "@/lib/site-config";
import "./globals.css";
import { PageTransition } from "@/components/page-transition";
import Providers from "./providers";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(personConfig.siteUrl),
  title: {
    default: `${personConfig.name} | Software Engineer`,
    template: `%s | ${personConfig.name}`,
  },
  description: personConfig.description,
  keywords: [
    personConfig.name,
    "software engineer",
    "full-stack developer",
    "open source",
    "c15t",
    "TypeScript",
    "React",
  ],
  authors: [{ name: personConfig.name }],
  creator: personConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: personConfig.siteUrl,
    siteName: personConfig.name,
    title: `${personConfig.name} | Software Engineer`,
    description: personConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    creator: personConfig.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: personConfig.name,
  url: personConfig.siteUrl,
  jobTitle: personConfig.jobTitle,
  sameAs: personConfig.sameAs,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const githubUrl = personConfig.sameAs.find((url) => url.includes("github.com/"));
  const githubUsername = githubUrl?.split("/").at(-1) ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${nunito.variable} grid-background antialiased`}>
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          <div className="min-h-screen">
            <div className="container mx-auto max-w-(--breakpoint-lg) px-4 py-8">
              <div className="grid grid-cols-1 gap-0 md:grid-cols-3 md:gap-6">
                <div className="col-span-1">
                  <Sidebar
                    profile={<Profile />}
                    secondary={
                      githubUsername ? <OSSActivity username={githubUsername} /> : null
                    }
                  />
                </div>
                <main className="md:col-span-2">
                  <PageTransition>
                    <div className="space-y-6">{children}</div>
                  </PageTransition>
                </main>
              </div>
            </div>
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
