import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { getViewer } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Consisthon — A little better, together.",
    template: "%s · Consisthon",
  },
  description:
    "Turn your goals into a daily habit. Create a room, show your work, and build consistency together.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SiteHeader viewer={viewer} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
