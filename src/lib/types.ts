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
  created_at: string;
  photos?: { storage_key: string; position: number }[];
  profile?: { display_name: string; phone_wa: string | null };
};
