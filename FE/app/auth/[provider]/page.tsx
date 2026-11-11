import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Callback from "./callback";

import {
  CONNECTED_SOCIAL_PROVIDERS,
  isConnectedSocialProvider,
} from "../../../src/features/social-login/model/socialLogin";

export const metadata: Metadata = { referrer: "no-referrer" };
export const dynamicParams = false;

export function generateStaticParams() {
  return CONNECTED_SOCIAL_PROVIDERS.map((provider) => ({ provider }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  if (!isConnectedSocialProvider(provider)) notFound();
  return <Callback provider={provider} />;
}
