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
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Dernière mise à jour : 2 septembre 2026</p>

        <h2 style={{ fontSize: 17, marginTop: 24 }}>Responsable du traitement</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          {LEGAL.editorName}, {LEGAL.editorAddress}. Vous pouvez nous joindre via le <Link href="/retours">formulaire de contact</Link>
          {contact ? <> ou à <a href={`mailto:${contact}`}>{contact}</a></> : null}.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Données collectées</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li><strong>Compte</strong> : email, nom affiché, et le numéro WhatsApp que vous choisissez de publier sur vos annonces.</li>
          <li><strong>Contenus</strong> : annonces, photos, favoris, notes attribuées aux restaurants.</li>
          <li><strong>Demandes</strong> : signalements, messages, propositions d&apos;événements et contacts transmis pour pouvoir vous répondre.</li>
          <li><strong>Fréquentation</strong> : pages vues, associées à un identifiant aléatoire stocké dans votre navigateur,
            sans lien avec votre identité — il sert uniquement à ne pas compter deux fois la même visite.</li>
        </ul>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Finalités et bases légales</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li><strong>Exécuter le service</strong> : créer le compte, publier et gérer les contenus demandés.</li>
          <li><strong>Intérêt légitime</strong> : modérer les contenus, prévenir les abus, répondre aux demandes et améliorer le service.</li>
          <li><strong>Obligations légales</strong> : répondre aux demandes des autorités et exercer ou défendre des droits.</li>
        </ul>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Ce qui est public</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Le nom affiché et le numéro WhatsApp d&apos;un vendeur sont accessibles avec ses annonces publiques.
          L&apos;email du compte et les contacts fournis pour un événement, une correction ou une revendication
          ne sont pas publiés. L&apos;identité des personnes qui consultent, ajoutent un favori ou notent un
          restaurant n&apos;est pas communiquée aux autres utilisateurs ; seuls des totaux sont présentés.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Destinataires et prestataires</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Les données sont accessibles aux personnes chargées de l&apos;administration de Ti Kanal et aux
          prestataires nécessaires au fonctionnement : Supabase pour la base, l&apos;authentification et les
          photos, Vercel pour l&apos;hébergement, et le prestataire d&apos;envoi d&apos;emails configuré. Les cartes
          utilisent OpenStreetMap ; les liens vers WhatsApp, Google Maps et les réseaux sociaux ne sont
          ouverts qu&apos;à votre demande. Aucune donnée n&apos;est vendue à des fins publicitaires.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Où et combien de temps</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Le compte et ses contenus sont conservés tant que le compte ou la publication existe. Une annonce
          supprimée est retirée avec ses données associées et ses photos. Les données de fréquentation sont
          conservées au maximum treize mois ; les demandes de support et de modération sont supprimées ou
          anonymisées lorsqu&apos;elles ne sont plus utiles, sauf obligation légale contraire. Certains prestataires
          peuvent traiter des données hors de l&apos;Espace économique européen sous les garanties prévues par le RGPD.
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
          {contact ? <> ou à <a href={`mailto:${contact}`}>{contact}</a></> : null}. Une preuve d&apos;identité
          peut être demandée uniquement en cas de doute raisonnable. Vous pouvez aussi saisir la
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
