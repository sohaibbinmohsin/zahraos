/**
 * True when `url` is worth rendering as an <img> logo.
 *
 * Guards against the 1x1 placeholder pixels that the Youth Republic seed script
 * writes into `organizations.logo_url` (a ~118-char `data:image/png;base64,...`
 * string). Those scale up to a solid colour square, so treat any tiny data URI
 * as "no logo" and fall back to an initials chip.
 */
export function isDisplayableLogo(url: string | null | undefined): url is string {
  if (!url) return false;
  if (/^https?:\/\//i.test(url)) return true;
  return url.startsWith("data:image/") && url.length > 512;
}
