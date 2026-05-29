import { headers } from "next/headers";

export async function getGalleryUrl(handle: string): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL);
    const hostname = siteUrl.hostname;
    const protocol = siteUrl.protocol.replace(":", "");
    return `${protocol}://${handle}.${hostname}`;
  }

  const headersList = await headers();
  const host = headersList.get("host");
  if (host) {
    const protocol = host.includes("localhost") ? "http" : "https";
    if (host.includes("localhost")) {
      return `${protocol}://${handle}.localhost:3000`;
    }
    const hostname = host.split(":")[0].replace(/^www\./, "");
    return `${protocol}://${handle}.${hostname}`;
  }

  return `https://${handle}.galleryclub.online`;
}
