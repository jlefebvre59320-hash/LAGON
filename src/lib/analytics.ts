"use client";
import { supabase } from "./supabase";

const VIEWER_KEY = "tk_viewer";
const OPT_OUT_KEY = "tk_analytics_optout";

/* Identifiant aléatoire de navigateur, tiré une fois et gardé en local.
   Aucun lien avec un compte, aucune donnée personnelle : il sert seulement à
   ne pas compter dix visiteurs quand une personne recharge dix fois la page. */
function viewerKey(): string | null {
  try {
    let key = localStorage.getItem(VIEWER_KEY);
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem(VIEWER_KEY, key);
    }
    return key;
  } catch {
    return null; // navigation privée, stockage refusé : on compte sans dédoublonner
  }
}

/* Type d'appareil, en trois catégories. Volontairement grossier : savoir
   qu'une visite vient d'un mobile suffit à décider si l'écran est bien
   pensé, alors qu'un user-agent complet identifie une personne. */
function appareil(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablette";
  if (/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "ordinateur";
}

/* Provenance, ramenée à une poignée de valeurs fermées. Le domaine
   référent n'est jamais conservé : on retient « google », pas l'URL de la
   recherche, qui contiendrait les mots tapés. Une navigation interne ne
   compte pas comme une provenance — sinon tout le trafic viendrait du site
   lui-même dès la deuxième page. */
function provenance(): string {
  const ref = document.referrer;
  if (!ref) return "direct";
  let hote: string;
  try {
    const url = new URL(ref);
    if (url.host === window.location.host) return "direct";
    hote = url.host.toLowerCase();
  } catch {
    return "autre";
  }
  if (/(^|\.)google\./.test(hote)) return "google";
  if (/(^|\.)bing\./.test(hote)) return "bing";
  if (/(^|\.)(facebook\.com|fb\.me|m\.facebook\.com)$/.test(hote)) return "facebook";
  if (/(^|\.)instagram\.com$/.test(hote)) return "instagram";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(hote)) return "whatsapp";
  return "autre";
}

/* Une vue par page et par onglet. L'échec est silencieux : une statistique
   perdue ne doit jamais casser l'affichage d'une annonce. */
export async function recordView(path: string, listingId?: string) {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(OPT_OUT_KEY) === "1") return;
    const once = `tk_seen:${path}`;
    if (sessionStorage.getItem(once)) return;
    const key = viewerKey();
    if (!key) return;
    sessionStorage.setItem(once, "1");
    await supabase().rpc("record_page_view", {
      p_path: path,
      p_listing_id: listingId ?? null,
      p_viewer_key: key,
      p_device: appareil(),
      p_source: provenance(),
    });
  } catch {
    /* ignoré volontairement */
  }
}
