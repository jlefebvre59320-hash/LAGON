import Link from "next/link";
import { SiteHeader } from "@/components/Brand";
import AudienceOptOut from "@/components/AudienceOptOut";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Confidentialité — Ti Kanal" };

export default function Confidentialite() {
  const contact = LEGAL.contactEmail;
  return (
    <div>
      <SiteHeader />
      <main className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 64 }}>
        <h1 style={{ fontSize: 26 }}>Politique de confidentialité</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Dernière mise à jour : 4 septembre 2026</p>

        <h2 style={{ fontSize: 17, marginTop: 24 }}>Responsable du traitement</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          {LEGAL.editorName}, {LEGAL.editorAddress}. Vous pouvez nous joindre via le <Link href="/retours">formulaire de contact</Link>
          {contact ? <> ou à <a href={`mailto:${contact}`}>{contact}</a></> : null}.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Données collectées</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li><strong>Compte</strong> : email, nom affiché, quartier si vous le renseignez, et le numéro WhatsApp que vous choisissez de publier sur vos annonces.</li>
          <li><strong>Contenus</strong> : annonces, photos, favoris, alertes de recherche, évaluations que vous laissez à d&apos;autres membres.</li>
          <li><strong>Échanges</strong> : messages envoyés par la messagerie du site, signalements, retours et demandes transmis pour pouvoir vous répondre.</li>
          <li><strong>Notifications</strong> : si vous les activez, l&apos;identifiant technique de votre navigateur pour les notifications push. Il ne contient aucune donnée personnelle et se supprime en désactivant l&apos;option.</li>
          <li><strong>Fréquentation</strong> : pages vues, associées à un identifiant aléatoire stocké dans votre navigateur,
            sans lien avec votre identité — il sert uniquement à ne pas compter deux fois la même visite.</li>
          <li><strong>Sur votre appareil seulement</strong> : la liste des dernières annonces consultées, conservée dans votre navigateur et jamais transmise.</li>
        </ul>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Finalités et bases légales</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li><strong>Exécuter le service</strong> : créer le compte, publier et gérer les annonces, acheminer les messages, envoyer les alertes que vous avez demandées.</li>
          <li><strong>Intérêt légitime</strong> : modérer les contenus, prévenir les arnaques et les abus, répondre aux demandes et améliorer le service.</li>
          <li><strong>Obligations légales</strong> : répondre aux demandes des autorités et exercer ou défendre des droits.</li>
        </ul>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Ce qui est public</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Chaque membre dispose d&apos;une <strong>fiche publique</strong> : nom affiché, ancienneté du compte, quartier
          déclaré ou déduit de ses annonces, nombre d&apos;annonces en ligne, publiées et vendues, taux de réponse aux
          messages reçus (à partir de trois conversations), moyenne et détail des évaluations reçues. Les
          <strong> évaluations</strong> laissées à un membre sont publiques avec le nom affiché de leur auteur et
          l&apos;annonce concernée. Le numéro WhatsApp n&apos;apparaît qu&apos;avec les annonces de son auteur.
          L&apos;email du compte, le contenu des messages privés, les alertes et les favoris ne sont jamais publiés.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Modération</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Les annonces, les messages et les commentaires d&apos;évaluation sont analysés automatiquement à leur
          création (termes interdits, indices d&apos;arnaque, prix, doublons, comportement du compte) pour
          produire un score de risque. Un contenu manifestement interdit peut être refusé ; les cas douteux sont
          soumis à une personne. Les <strong>photos</strong> des annonces sont transmises au prestataire
          Sightengine pour détecter nudité, violence, armes et symboles haineux ; seuls des scores sont
          conservés, jamais l&apos;image chez ce prestataire. Les décisions de modération et les signalements sont
          conservés avec le score du moment pour améliorer les règles et traiter les recours. Un compte peut être
          suspendu ou fermé en cas d&apos;abus.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Destinataires et prestataires</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Les données sont accessibles aux personnes chargées de l&apos;administration de Ti Kanal et aux
          prestataires nécessaires au fonctionnement : Supabase pour la base, l&apos;authentification et les
          photos, Vercel pour l&apos;hébergement, Resend pour l&apos;envoi des emails, Sightengine pour l&apos;analyse
          des photos, et les services de notification de votre navigateur si vous activez les notifications push.
          Les liens vers WhatsApp ne sont ouverts qu&apos;à votre demande. Aucune donnée n&apos;est vendue à des
          fins publicitaires.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Où et combien de temps</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Le compte et ses contenus sont conservés tant que le compte ou la publication existe. Une annonce
          supprimée est retirée avec ses données associées et ses photos ; les messages d&apos;une conversation
          restent lisibles par ses deux participants tant qu&apos;ils gardent leur compte. Les données de
          fréquentation sont conservées au maximum treize mois ; les signalements, décisions de modération et
          demandes de support sont supprimés ou anonymisés lorsqu&apos;ils ne sont plus utiles, sauf obligation
          légale contraire. Certains prestataires peuvent traiter des données hors de l&apos;Espace économique
          européen sous les garanties prévues par le RGPD.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Mesure d&apos;audience</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Ti Kanal utilise sa propre mesure de fréquentation, sans publicité ni suivi entre plusieurs sites.
          Vous pouvez vous y opposer à tout moment sur cet appareil :
        </p>
        <AudienceOptOut />

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Vos droits</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Vous pouvez demander l&apos;accès, la rectification, l&apos;effacement, la limitation, l&apos;opposition ou,
          lorsque les conditions sont réunies, la portabilité de vos données via le <Link href="/retours">formulaire de contact</Link>
          {contact ? <> ou à <a href={`mailto:${contact}`}>{contact}</a></> : null}. Depuis votre espace, vous
          modifiez vous-même votre nom, votre quartier, votre numéro, vos préférences de notification et vos
          alertes, et vous supprimez vos annonces. Une preuve d&apos;identité peut être demandée uniquement en
          cas de doute raisonnable. Vous pouvez aussi saisir la
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer"> CNIL</a>.
        </p>

        <p style={{ marginTop: 28 }}>
          <Link href="/mentions-legales" style={{ fontSize: 13.5, color: "var(--gold-deep)" }}>
            ← Mentions légales
          </Link>
        </p>
      </main>
    </div>
  );
}
