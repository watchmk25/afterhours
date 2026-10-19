import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AfterHours — A workspace for your next gathering",
  description:
    "Explore eligible books and shape your next bookstore or book-club event in the AfterHours sample workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
