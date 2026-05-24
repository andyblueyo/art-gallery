import { headers } from "next/headers";

export async function getGalleryUrl(handle: string): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return `${process.env.NEXT_PUBLIC_SITE_URL}/${handle}`;
  }

  const headersList = await headers();
  const host = headersList.get("host");
  if (host) {
    const protocol = host.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${host}/${handle}`;
  }

  return `https://artpenny.com/${handle}`;
}
