import { ImageResponse } from "next/og";

/* L'aperçu qui s'affiche quand un lien d'annonce circule sur WhatsApp :
   la photo, le titre et le prix directement dans la vignette. C'est la
   vitrine du site dans les groupes de l'île — elle doit donner envie
   d'appuyer. En cas de pépin (annonce disparue, réseau), on sert la carte
   générique plutôt qu'une erreur : un aperçu cassé tue le partage. */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Annonce sur Ti Kanal";

type Row = {
  title: string;
  price_cents: number | null;
  subcategory: string;
  intent: string | null;
  photos: { storage_key: string; position: number }[];
};

const eur = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(cents / 100)
    .replace(/ /g, " ");

async function fetchListing(id: string): Promise<Row | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const res = await fetch(
      `${url}/rest/v1/listings?id=eq.${id}&select=title,price_cents,subcategory,intent,photos:listing_photos(storage_key,position)`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 600 } }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function Fallback() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#05282c" }}>
      <div style={{ color: "#c9a86a", fontSize: 92, fontWeight: 700, letterSpacing: 14 }}>TI KANAL</div>
      <div style={{ color: "#f6f2e9", fontSize: 34, letterSpacing: 10, marginTop: 18 }}>SAINT-BARTHÉLEMY</div>
      <div style={{ width: 90, height: 4, background: "#c9a86a", marginTop: 34 }} />
      <div style={{ color: "#f6f2e9", fontSize: 26, marginTop: 30, opacity: 0.85 }}>
        Le canal des bonnes affaires de l’île
      </div>
    </div>
  );
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await fetchListing(id);
  if (!l) return new ImageResponse(<Fallback />, size);

  const photoKey = l.photos?.slice().sort((a, b) => a.position - b.position)[0]?.storage_key;
  const photoSrc = photoKey
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${photoKey}`
    : null;
  const wanted = l.intent === "wanted";
  const price = l.price_cents == null
    ? wanted ? "Budget à discuter" : "Prix à discuter"
    : (wanted ? "Budget " : "") + eur(l.price_cents);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#05282c" }}>
        {photoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoSrc} alt="" width={620} height={630}
            style={{ width: 620, height: 630, objectFit: "cover" }} />
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "52px 56px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#c9a86a", fontSize: 40, fontWeight: 700, letterSpacing: 8 }}>TI KANAL</div>
            <div style={{ color: "#f6f2e9", fontSize: 19, letterSpacing: 6, marginTop: 6, opacity: 0.8 }}>
              SAINT-BARTHÉLEMY
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex" }}>
              <div style={{ background: "#c9a86a", color: "#05282c", fontSize: 20, fontWeight: 700,
                padding: "8px 22px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 2 }}>
                {l.subcategory}
              </div>
            </div>
            <div style={{ color: "#f6f2e9", fontSize: photoSrc ? 44 : 58, fontWeight: 700, lineHeight: 1.15,
              marginTop: 26, maxHeight: 220, overflow: "hidden" }}>
              {l.title}
            </div>
            <div style={{ color: "#c9a86a", fontSize: photoSrc ? 52 : 64, fontWeight: 700, marginTop: 24 }}>
              {price}
            </div>
          </div>
          <div style={{ width: 90, height: 4, background: "#c9a86a", display: "flex" }} />
        </div>
      </div>
    ),
    size
  );
}
