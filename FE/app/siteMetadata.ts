import type { Metadata } from "next";

export const siteUrl = new URL(
  process.env.FE_SERVICE_URL?.trim() || "http://localhost:3000",
);
if (!["http:", "https:"].includes(siteUrl.protocol)) {
  throw new Error("FE_SERVICE_URL은 HTTP 또는 HTTPS URL이어야 합니다.");
}

const shareImage = {
  url: "/brand/bibbidi-share.png",
  width: 1728,
  height: 910,
  alt: "비비디 로고",
};

export function createPublicMetadata(
  pathname: "/" | "/landing/",
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: pathname },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ko_KR",
      url: pathname,
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImage],
    },
  };
}

export const preparationMetadata = createPublicMetadata(
  "/",
  "비비디 | 결혼 준비 목록과 체크리스트",
  "결혼 준비 단계와 할 일을 둘러보고, 내 체크리스트에 담아 준비 현황을 관리해요.",
);
