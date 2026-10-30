import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AfterHours — A workspace for your next gathering",
  description:
    "Describe your club and its cultural tastes, discover a relevant focus, and shape an editable gathering with AfterHours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
