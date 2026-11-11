import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "../src/styles/fonts.css";
import "../src/styles/tokens.css";
import "../src/styles/colors.css";
import "../src/styles/layout.css";
import "../src/index.css";

const title = "비비디 | 나만의 결혼 체크리스트";
const description = "결혼 준비 체크리스트와 일정을 한 곳에서 관리해요.";
const metadataBase = new URL(
  process.env.FE_SERVICE_URL?.trim() || "http://localhost:3000",
);
if (!["http:", "https:"].includes(metadataBase.protocol)) {
  throw new Error("FE_SERVICE_URL은 HTTP 또는 HTTPS URL이어야 합니다.");
}

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  icons: { icon: "/brand/bibbidi-favicon-48.png" },
  openGraph: {
    title: "비비디",
    description,
    type: "website",
    locale: "ko_KR",
    url: "/",
    images: [
      {
        url: "/brand/bibbidi-share.png",
        width: 1728,
        height: 910,
        alt: "비비디 로고",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "비비디",
    description,
    images: [{ url: "/brand/bibbidi-share.png", alt: "비비디 로고" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div id="root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
