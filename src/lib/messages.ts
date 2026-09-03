/* Messagerie interne — une conversation par (annonce, intéressé).
   Les écritures passent toutes par des fonctions SQL security definer :
   côté navigateur il n'y a donc que des appels rpc, jamais d'insert. */

export type Conversation = {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_status: string | null;
  photo_key: string | null;
  /* Vrai si c'est moi qui ai publié l'annonce — change le vocabulaire
     affiché : on ne dit pas la même chose à un vendeur et à un acheteur. */
  je_suis_auteur: boolean;
  autre_nom: string;
  last_message_at: string;
  dernier: string | null;
  non_lus: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export const MESSAGE_MAX = 2000;

/* Horodatage de fil de discussion : l'heure seule aujourd'hui, la date
   au-delà — comme dans une application de messagerie, où le jour n'a
   d'intérêt que passé minuit. */
export function heureMessage(iso: string): string {
  const d = new Date(iso);
  const maintenant = new Date();
  const memeJour = d.toDateString() === maintenant.toDateString();
  if (memeJour) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (d.toDateString() === hier.toDateString())
    return `Hier ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/* Les erreurs remontées par PostgREST ne sont pas des instances d'Error :
   le message utile vit dans une propriété `message` d'un objet quelconque. */
export function messageErreur(cause: unknown, defaut: string): string {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    const m = String((cause as { message: unknown }).message);
    if (m) return m;
  }
  return defaut;
}
