import { safeEmail } from "./urls";

export const LEGAL = {
  editorName: process.env.NEXT_PUBLIC_LEGAL_EDITOR_NAME?.trim() || "Ti Kanal",
  editorAddress: process.env.NEXT_PUBLIC_LEGAL_EDITOR_ADDRESS?.trim() || "Saint-Barthélemy, France",
  publicationDirector: process.env.NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR?.trim() || "Direction de Ti Kanal",
  contactEmail: safeEmail(process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL),
} as const;
