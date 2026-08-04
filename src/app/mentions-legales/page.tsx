import Link from "next/link";
import { SiteHeader } from "@/components/Brand";

export const metadata = { title: "Mentions légales — Ti Kanal" };

/* Les [crochets] sont à compléter par l'éditeur du site avant lancement
   public : les publier tels quels vaut mieux que pas de page du tout,
   mais pas mieux qu'une page complète. */
export default function MentionsLegales() {
  return (
    <div>
      <SiteHeader />
      <main className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 64 }}>
        <h1 style={{ fontSize: 26 }}>Mentions légales</h1>

        <h2 style={{ fontSize: 17, marginTop: 26 }}>Éditeur du site</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Ti Kanal — [nom / raison sociale de l&apos;éditeur]<br />
          [Adresse à Saint-Barthélemy]<br />
          Contact : [adresse email de contact]<br />
          Directeur de la publication : [nom]
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Hébergement</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Application hébergée par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.<br />
          Données hébergées par Supabase (projet situé dans l&apos;Union européenne).
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

        <p style={{ marginTop: 28 }}>
          <Link href="/confidentialite" style={{ fontSize: 13.5, color: "var(--gold-deep)" }}>
            Politique de confidentialité →
          </Link>
        </p>
      </main>
    </div>
  );
}
