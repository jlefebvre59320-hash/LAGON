import Link from "next/link";
import { SiteHeader } from "@/components/Brand";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Mentions légales — Ti Kanal" };

export default function MentionsLegales() {
  const contact = LEGAL.contactEmail;
  return (
    <div>
      <SiteHeader />
      <main className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 64 }}>
        <h1 style={{ fontSize: 26 }}>Mentions légales</h1>

        <h2 style={{ fontSize: 17, marginTop: 26 }}>Éditeur du site</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          {LEGAL.editorName}<br />
          {LEGAL.editorAddress}<br />
          Contact : {contact ? <a href={`mailto:${contact}`}>{contact}</a> : <Link href="/retours">formulaire de contact</Link>}<br />
          Directeur de la publication : {LEGAL.publicationDirector}
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Hébergement</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Application hébergée par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.<br />
          Base de données et authentification fournies par Supabase, selon la région configurée pour le projet.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Nature du service</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Ti Kanal est une plateforme de petites annonces entre particuliers et un annuaire
          d&apos;établissements de Saint-Barthélemy. Les annonces sont publiées sous la seule
          responsabilité de leurs auteurs ; les transactions se concluent directement entre les
          personnes, sans intermédiation de paiement ni de livraison. Tout contenu illicite peut
          être signalé via le lien « Signaler » présent sur chaque annonce.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Annuaire des restaurants</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Les informations de l&apos;annuaire sont rassemblées de bonne foi (déclarations des
          établissements, sources ouvertes dont OpenStreetMap sous licence ODbL) et fournies à
          titre indicatif. Un établissement peut demander la correction ou le retrait de sa fiche
          à tout moment via « C&apos;est votre établissement ? » sur sa fiche — la demande est
          traitée sans délai.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Propriété intellectuelle</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          La marque, l&apos;identité graphique et les contenus éditoriaux propres à Ti Kanal sont protégés.
          Les annonces, marques et photographies publiées par les utilisateurs ou établissements restent
          sous la responsabilité et, le cas échéant, la propriété de leurs auteurs.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Contact et signalement</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Une annonce peut être signalée depuis sa fiche. Pour toute autre demande concernant un contenu,
          une fiche d&apos;établissement ou vos données personnelles, utilisez le <Link href="/retours">formulaire de contact</Link>
          {contact ? <> ou écrivez à <a href={`mailto:${contact}`}>{contact}</a></> : null}.
        </p>

        <p style={{ marginTop: 28 }}>
          <Link href="/confidentialite" style={{ fontSize: 13.5, color: "var(--gold-deep)" }}>
            Politique de confidentialité →
          </Link>
        </p>
      </main>
    </div>
  );
}
