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
  photos?: { storage_key: string; position: number }[];
  /* allow_messages arrive avec la migration 0025 : optionnel pour que la
     fiche reste lisible tant qu'elle n'est pas passée. */
  profile?: { display_name: string; phone_wa: string | null; allow_messages?: boolean };
};
