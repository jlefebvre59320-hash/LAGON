/* Tout ce que le site dit à propos des emails qu'il envoie, au même
   endroit : la même phrase à la création de compte, au mot de passe
   oublié, au lien de connexion et au changement d'adresse. */

export const EXPEDITEUR_VISIBLE = "no-reply@tikanal.com";

/* Le rappel qui évite la moitié des « je n'ai rien reçu » : l'email est
   souvent arrivé, mais dans les indésirables. On nomme l'expéditeur pour
   qu'on puisse le chercher, et on parle de « spams » aussi — c'est le mot
   que les gens tapent. */
export const RAPPEL_SPAM =
  `Rien reçu au bout de quelques minutes ? Regardez vos indésirables (spams) : l’expéditeur est ${EXPEDITEUR_VISIBLE}.`;
