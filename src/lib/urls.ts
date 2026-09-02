/** Utilitaires partagés pour ne jamais rendre un protocole exécutable fourni
 * par une fiche, tout en gardant des formulaires agréables à utiliser. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE = /^[a-zA-Z0-9._-]{1,64}$/;

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Accepte aussi « exemple.com » dans les formulaires et le normalise. */
export function normalizeExternalUrl(value: string | null | undefined): string | null {
  const clean = value?.trim();
  if (!clean) return null;
  return safeExternalUrl(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
}

export function safeEmail(value: string | null | undefined): string | null {
  const clean = value?.trim();
  return clean && clean.length <= 254 && EMAIL.test(clean) ? clean : null;
}

export function emailHref(value: string | null | undefined): string | null {
  const email = safeEmail(value);
  return email ? `mailto:${encodeURIComponent(email)}` : null;
}

export function normalizePhoneNumber(value: string | null | undefined): string | null {
  const clean = value?.trim().replace(/[\s().-]/g, "");
  return clean && /^\+[1-9]\d{7,14}$/.test(clean) ? clean : null;
}

export function socialUrl(
  network: "instagram" | "snapchat" | "tiktok",
  value: string | null | undefined
): string | null {
  const handle = value?.trim().replace(/^@/, "");
  if (!handle || !HANDLE.test(handle)) return null;
  const encoded = encodeURIComponent(handle);
  if (network === "instagram") return `https://www.instagram.com/${encoded}/`;
  if (network === "snapchat") return `https://www.snapchat.com/add/${encoded}`;
  return `https://www.tiktok.com/@${encoded}`;
}

export function normalizeSocialHandle(value: string | null | undefined): string | null {
  const handle = value?.trim().replace(/^@/, "");
  return handle && HANDLE.test(handle) ? handle : null;
}

export function safeReturnTo(value: string | null | undefined, fallback = "/deposer"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://tikanal.local");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function connexionUrl(returnTo: string): string {
  return `/connexion?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
