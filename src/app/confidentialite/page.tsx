import Link from "next/link";
import { SiteHeader } from "@/components/Brand";

export const metadata = { title: "Confidentialité — Ti Kanal" };

export default function Confidentialite() {
  return (
    <div>
      <SiteHeader />
      <main className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 64 }}>
        <h1 style={{ fontSize: 26 }}>Politique de confidentialité</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Dernière mise à jour : [date]</p>

        <h2 style={{ fontSize: 17, marginTop: 24 }}>Ce que nous collectons</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li><strong>Compte</strong> : email, nom affiché, et le numéro WhatsApp que vous choisissez de publier sur vos annonces.</li>
          <li><strong>Contenus</strong> : annonces, photos, favoris, notes attribuées aux restaurants.</li>
          <li><strong>Fréquentation</strong> : pages vues, associées à un identifiant aléatoire stocké dans votre navigateur,
            sans lien avec votre identité — il sert uniquement à ne pas compter deux fois la même visite.</li>
        </ul>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Ce que nous ne faisons pas</h2>
        <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Aucune revente ni transmission de données à des tiers.</li>
          <li>Aucun cookie publicitaire, aucun traceur tiers.</li>
          <li>Votre email n&apos;est jamais affiché publiquement.</li>
          <li>Qui consulte une annonce, met en favori ou note un restaurant n&apos;est jamais révélé — seuls des totaux le sont.</li>
        </ul>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Où et combien de temps</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Les données sont stockées chez Supabase dans l&apos;Union européenne. Votre compte et ses
          contenus sont conservés tant que le compte existe ; supprimer une annonce supprime ses
          photos et données associées.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 22 }}>Vos droits</h2>
        <p style={{ fontSize: 14, lineHeight: 1.7 }}>
          Conformément au RGPD, vous pouvez accéder à vos données, les rectifier, les supprimer,
          ou demander la suppression complète de votre compte en écrivant à
          [adresse email de contact]. Vous pouvez saisir la CNIL (cnil.fr) si vous estimez que vos
          droits ne sont pas respectés.
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
