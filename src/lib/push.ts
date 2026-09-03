"use client";
import { supabase } from "./supabase";

/* Abonnement de l'appareil courant aux notifications push.
 *
 * Trois conditions doivent être réunies, et elles échouent différemment :
 * le navigateur doit savoir faire, la clé publique doit être configurée,
 * et la personne doit accorder l'autorisation. Chacune renvoie un motif
 * distinct pour que l'écran puisse dire ce qui manque, plutôt qu'un
 * « impossible » qui n'aide personne.
 *
 * Sur iPhone, le push n'existe que si le site a été ajouté à l'écran
 * d'accueil : c'est une contrainte d'Apple, pas un défaut du site, et il
 * faut le dire clairement à ce moment-là.
 */

export type EtatPush =
  | "inconnu"          // pas encore vérifié
  | "indisponible"     // navigateur sans push
  | "ios-non-installe" // iPhone, site non ajouté à l'écran d'accueil
  | "non-configure"    // clé VAPID absente côté serveur
  | "refuse"           // autorisation refusée par la personne
  | "inactif"          // possible, mais pas abonné
  | "actif";

const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushDisponible(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

/* Un iPhone n'expose PushManager que dans une application installée.
   Le détecter permet d'afficher « ajoutez le site à votre écran d'accueil »
   au lieu de « votre navigateur ne sait pas faire », qui serait faux. */
function iosNonInstalle(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!ios) return false;
  const installe = window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !installe;
}

export async function etatPush(): Promise<EtatPush> {
  if (iosNonInstalle()) return "ios-non-installe";
  if (!pushDisponible()) return "indisponible";
  if (!CLE_PUBLIQUE) return "non-configure";
  if (Notification.permission === "denied") return "refuse";
  const registration = await navigator.serviceWorker.getRegistration();
  const abonnement = await registration?.pushManager.getSubscription();
  return abonnement ? "actif" : "inactif";
}

export async function activerPush(): Promise<EtatPush> {
  if (iosNonInstalle()) return "ios-non-installe";
  if (!pushDisponible()) return "indisponible";
  if (!CLE_PUBLIQUE) return "non-configure";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "refuse";

  /* ready plutôt que getRegistration : au premier passage le service
     worker vient peut-être d'être enregistré et n'est pas encore actif. */
  const registration = await navigator.serviceWorker.ready;
  const abonnement = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlVersOctets(CLE_PUBLIQUE),
  });

  const brut = abonnement.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!brut.endpoint || !brut.keys?.p256dh || !brut.keys?.auth) return "inactif";

  const { data: session } = await supabase().auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return "inactif";

  /* onConflict sur endpoint : un navigateur peut réémettre le même,
     et empiler les lignes ferait autant de notifications identiques. */
  const { error } = await supabase().from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: brut.endpoint,
    p256dh: brut.keys.p256dh,
    auth: brut.keys.auth,
    appareil: nomAppareil(),
  }, { onConflict: "endpoint" });

  if (error) {
    // L'abonnement navigateur existe mais la base ne l'a pas : on le retire
    // plutôt que de laisser un appareil abonné à qui rien n'arrivera jamais.
    await abonnement.unsubscribe().catch(() => undefined);
    return "inactif";
  }
  return "actif";
}

export async function desactiverPush(): Promise<EtatPush> {
  if (!pushDisponible()) return "indisponible";
  const registration = await navigator.serviceWorker.getRegistration();
  const abonnement = await registration?.pushManager.getSubscription();
  if (abonnement) {
    await supabase().from("push_subscriptions").delete().eq("endpoint", abonnement.endpoint);
    await abonnement.unsubscribe().catch(() => undefined);
  }
  return "inactif";
}

/* Un libellé lisible pour reconnaître ses appareils dans la liste. */
function nomAppareil(): string {
  if (typeof navigator === "undefined") return "Appareil";
  const ua = navigator.userAgent;
  const systeme = /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : "Appareil";
  const navigateur = /CriOS|Chrome/.test(ua) ? "Chrome"
    : /Firefox/.test(ua) ? "Firefox"
    : /Edg/.test(ua) ? "Edge"
    : /Safari/.test(ua) ? "Safari"
    : "";
  return navigateur ? `${systeme} · ${navigateur}` : systeme;
}

/* La clé VAPID circule en base64url ; l'API push veut des octets bruts. */
function base64UrlVersOctets(base64Url: string): ArrayBuffer {
  const bourrage = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + bourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  // Un ArrayBuffer explicite : applicationServerKey n'accepte pas une vue
  // dont le tampon est seulement « ArrayBufferLike ».
  const tampon = new ArrayBuffer(brut.length);
  const octets = new Uint8Array(tampon);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return tampon;
}
