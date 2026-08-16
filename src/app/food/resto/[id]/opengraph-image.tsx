import { ImageResponse } from "next/og";

/* Aperçu WhatsApp d'une fiche restaurant : nom, cuisine, quartier et prix
   moyen dans la palette St Barth Food. Pas de photo d'établissement (on
   n'en a pas le droit sans accord écrit) : la carte typographique fait le
   travail, comme sur le site. */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Restaurant sur St Barth Food";

type Row = {
  name: string;
  cuisine: string;
  quartier: string;
  avg_price_eur: number | null;
  price_range: number;
};

async function fetchResto(id: string): Promise<Row | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const res = await fetch(
      `${url}/rest/v1/restaurants?id=eq.${id}&select=name,cuisine,quartier,avg_price_eur,price_range`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await fetchResto(id);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: "#33201c", padding: "56px 64px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#d9a05b", fontSize: 40, fontWeight: 700, letterSpacing: 8 }}>ST BARTH FOOD</div>
          <div style={{ color: "#f8f2e8", fontSize: 19, letterSpacing: 6, marginTop: 6, opacity: 0.8 }}>
            BIEN MANGER, TOUTE L’ÎLE
          </div>
        </div>

        {r ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex" }}>
              <div style={{ background: "#d9a05b", color: "#33201c", fontSize: 21, fontWeight: 700,
                padding: "8px 22px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 2 }}>
                {r.cuisine}
              </div>
            </div>
            <div style={{ color: "#f8f2e8", fontSize: 64, fontWeight: 700, lineHeight: 1.1,
              marginTop: 26, maxHeight: 150, overflow: "hidden" }}>
              {r.name}
            </div>
            <div style={{ color: "#ecc794", fontSize: 30, marginTop: 20, display: "flex" }}>
              {r.quartier}
              {r.avg_price_eur != null
                ? ` · ~${r.avg_price_eur} € / personne`
                : ` · ${"€".repeat(Math.max(1, Math.min(3, r.price_range)))}`}
            </div>
          </div>
        ) : (
          <div style={{ color: "#f8f2e8", fontSize: 42, fontWeight: 700 }}>
            Les restaurants de Saint-Barthélemy
          </div>
        )}

        <div style={{ width: 90, height: 4, background: "#d9a05b", display: "flex" }} />
      </div>
    ),
    size
  );
}
