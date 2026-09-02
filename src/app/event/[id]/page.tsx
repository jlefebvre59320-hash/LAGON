import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { SiteHeader } from "@/components/Brand";
import ShareButton from "@/components/ShareButton";
import { eventDay, type IslandEvent } from "@/lib/event";
import { serializeJsonLd } from "@/lib/jsonLd";
import { SITE_URL } from "@/lib/siteUrl";
import { publicSupabase } from "@/lib/supabaseServer";
import { safeExternalUrl } from "@/lib/urls";

const PUBLIC_EVENT_FIELDS = "id,title,category,venue,quartier,starts_at,ends_at,price,description,link,organizer,status";

const getEvent = cache(async (id: string): Promise<IslandEvent | null> => {
  const sb = publicSupabase();
  if (!sb) return null;
  const { data } = await sb.from("events").select(PUBLIC_EVENT_FIELDS)
    .eq("id", id).eq("status", "approved").maybeSingle();
  return (data as IslandEvent | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Événement indisponible — St Barth Event", robots: { index: false, follow: false } };
  const title = `${event.title} — St Barth Event`;
  const description = (event.description?.replace(/\s+/g, " ").trim()
    || `${event.category}${event.venue ? ` à ${event.venue}` : ""}, Saint-Barthélemy.`).slice(0, 160);
  const url = `${SITE_URL}/event/${event.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", locale: "fr_FR" },
  };
}

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    return (
      <>
        <SiteHeader site="event" />
        <main className="container" style={{ maxWidth: 680, paddingTop: 54, paddingBottom: 60, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>Cet événement n’est plus disponible.</h1>
          <Link href="/event">← Retour à l’agenda</Link>
        </main>
      </>
    );
  }

  const date = eventDay(event.starts_at);
  const externalLink = safeExternalUrl(event.link);
  const url = `${SITE_URL}/event/${event.id}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || undefined,
    startDate: event.starts_at,
    endDate: event.ends_at || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    isAccessibleForFree: /^gratuit/i.test(event.price),
    location: {
      "@type": "Place",
      name: event.venue || event.quartier || "Saint-Barthélemy",
      address: [event.venue, event.quartier, "Saint-Barthélemy"].filter(Boolean).join(", "),
    },
    organizer: event.organizer ? { "@type": "Organization", name: event.organizer } : undefined,
    url,
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <SiteHeader site="event" />
      <main className="container" style={{ maxWidth: 720, paddingTop: 18, paddingBottom: 64, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <Link href="/event" style={{ fontSize: 13, color: "var(--text-muted)" }}>← Retour à l’agenda</Link>
          <ShareButton title={event.title}
            text={`${event.title} — ${date.semaine} ${date.jour} ${date.mois} sur St Barth Event`}
            url={url} />
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 22 }}>
          <span style={{ flex: "0 0 auto", width: 68, textAlign: "center", background: "var(--green)",
            color: "var(--gold-light)", borderRadius: 14, padding: "10px 0" }}>
            <span style={{ display: "block", fontSize: 27, fontWeight: 800, lineHeight: 1 }}>{date.jour}</span>
            <span style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>{date.mois}</span>
          </span>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--gold-deep)" }}>
              {event.category}
            </span>
            <h1 style={{ margin: "3px 0 0", fontSize: "clamp(25px, 5vw, 34px)", lineHeight: 1.15 }}>{event.title}</h1>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 20, padding: "14px 16px", display: "grid", gap: 7, fontSize: 14 }}>
          <div><strong>Date :</strong> {date.semaine} {date.jour} {date.mois} à {date.heure}</div>
          {(event.venue || event.quartier) && <div><strong>Lieu :</strong> {[event.venue, event.quartier].filter(Boolean).join(" · ")}</div>}
          {event.price && <div><strong>Tarif :</strong> {event.price}</div>}
          {event.organizer && <div><strong>Organisateur :</strong> {event.organizer}</div>}
        </div>

        {event.description && (
          <p style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 20 }}>{event.description}</p>
        )}

        {externalLink && (
          <a href={externalLink} target="_blank" rel="noopener noreferrer" className="btn"
            style={{ marginTop: 8, fontSize: 14 }}>
            Billets / informations ↗
          </a>
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 28, lineHeight: 1.5 }}>
          Informations fournies par l’organisateur et relues avant publication. Vérifiez les éventuelles modifications auprès de lui.
        </p>
      </main>
    </div>
  );
}
