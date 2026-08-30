import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rukmini Memorial Public High School, Gohad, Bhind (MP)",
  description: "Official website of Rukmini Memorial Public High School — Main Bhind Road, Barahet Tiraha, Gohad, Bhind (MP). Contact: +919926230003",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

