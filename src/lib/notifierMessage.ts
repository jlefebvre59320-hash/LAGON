"use client";
import { supabase } from "./supabase";

/* Demande au serveur de prévenir par email la personne d'en face.
   Volontairement silencieux : l'email est un bonus, le message est déjà
   en base et la pastille du site prendra le relais. Une erreur ici ne
   doit jamais remonter à l'expéditeur, qui n'y peut rien. */
export async function notifierParEmail(conversationId: string): Promise<void> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch("/api/notifier-message", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ conversation_id: conversationId }),
      keepalive: true,
    });
  } catch {
    /* silence volontaire */
  }
}
