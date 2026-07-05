import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paperclip Company OS",
  description: "One-person AI media commerce operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
