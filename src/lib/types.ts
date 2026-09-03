import type { Intent, ModuleKey } from "./taxonomy";

export type Listing = {
  id: string;
  user_id: string;
  module: ModuleKey;
  subcategory: string;
  intent: Intent;
  status: "active" | "sold" | "expired" | "removed";
  title: string;
  description: string;
  price_cents: number | null;
  location: string;
  attrs: Record<string, string | number>;
  /* Fin de la mise en avant ; null ou date passée = annonce ordinaire. */
  featured_until: string | null;
  created_at: string;
  /* Modération (migration 0032). Optionnels : absents tant qu'elle n'est
     pas passée, et une annonce sans ces colonnes est simplement publiée. */
  review_state?: "published" | "watch" | "pending" | "blocked";
  risk_score?: number;
  risk_reasons?: { code: string; detail: string; points: number }[];
  moderation_note?: string | null;
  photos?: { storage_key: string; position: number }[];
  /* allow_messages arrive avec la migration 0025 : optionnel pour que la
     fiche reste lisible tant qu'elle n'est pas passée. */
  profile?: {
    display_name: string; phone_wa: string | null; allow_messages?: boolean;
    /* Tenus à jour par trigger depuis la migration 0031. */
    rating_avg?: number | null; rating_count?: number;
  };
};
