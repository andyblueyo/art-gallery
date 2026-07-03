export const SUPPORT_PLATFORMS = [
  {
    key: 'venmo_handle',
    label: 'venmo',
    base: 'https://venmo.com/',
    inputHint: '@yourhandle',
    normalize: (v: string) => v.trim().replace(/^@/, '').toLowerCase(),
  },
  {
    key: 'cashapp_handle',
    label: 'cash app',
    base: 'https://cash.app/$',
    inputHint: '$yourcashtag',
    normalize: (v: string) => v.trim().replace(/^\$/, '').toLowerCase(),
  },
  {
    key: 'kofi_handle',
    label: 'ko-fi',
    base: 'https://ko-fi.com/',
    inputHint: 'yourhandle',
    normalize: (v: string) => v.trim().toLowerCase(),
  },
  {
    key: 'patreon_handle',
    label: 'patreon',
    base: 'https://patreon.com/',
    inputHint: 'yourhandle',
    normalize: (v: string) => v.trim().toLowerCase(),
  },
  {
    key: 'paypal_handle',
    label: 'paypal',
    base: 'https://paypal.me/',
    inputHint: 'yourhandle',
    normalize: (v: string) => v.trim().toLowerCase(),
  },
  {
    key: 'buymeacoffee_handle',
    label: 'buy me a coffee',
    base: 'https://buymeacoffee.com/',
    inputHint: 'yourhandle',
    normalize: (v: string) => v.trim().toLowerCase(),
  },
] as const;

export type SupportPlatformKey = typeof SUPPORT_PLATFORMS[number]['key'];

export function buildSupportLinks(profile: Record<string, string | null | undefined>) {
  return SUPPORT_PLATFORMS
    .filter(p => !!profile[p.key])
    .map(p => ({
      label: p.label,
      url: `${p.base}${profile[p.key]}`,
    }));
}
