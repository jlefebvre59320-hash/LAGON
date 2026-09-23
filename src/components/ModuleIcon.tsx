import type { ModuleKey } from "@/lib/taxonomy";

/* Un pictogramme par univers, au trait, dans la couleur de l'univers.
   Cinq dessins simples qu'on reconnaît de loin : une voiture, une maison,
   une mallette, une clé à molette, une étiquette de prix. Ils remplacent
   l'île partout où l'on choisit ou illustre un univers — l'île, c'est la
   marque, pas une catégorie. */

const TRACES: Record<ModuleKey, React.ReactNode> = {
  vehicle: (
    <>
      <path d="M4 14.5 6 9.5a2 2 0 0 1 1.9-1.3h8.2A2 2 0 0 1 18 9.5l2 5" />
      <path d="M3.5 14.5h17a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H19a1 1 0 0 1-1-1v-.5H6V18a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-2.5a1 1 0 0 1 1-1Z" />
      <path d="M7 16.5h.01M17 16.5h.01" />
    </>
  ),
  housing: (
    <>
      <path d="M3.5 11.5 12 4.5l8.5 7" />
      <path d="M5.5 10.2V19a.8.8 0 0 0 .8.8h11.4a.8.8 0 0 0 .8-.8v-8.8" />
      <path d="M10 19.8v-5.3a.7.7 0 0 1 .7-.7h2.6a.7.7 0 0 1 .7.7v5.3" />
    </>
  ),
  job: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
      <path d="M3.5 12.5h17M12 11.5v2.5" />
    </>
  ),
  service: (
    <>
      <path d="M14.3 6.2a4 4 0 0 1 4.9 4.9l-2.4-.6-.7 2.6 2.6.7a4 4 0 0 1-4.9 4.9" />
      <path d="M14.3 6.2 5.6 14.9a1.6 1.6 0 0 0 0 2.3l1.2 1.2a1.6 1.6 0 0 0 2.3 0l8.7-8.7" />
      <path d="M6.6 17.4h.01" />
    </>
  ),
  goods: (
    <>
      <path d="M3.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5l8 8-9 9z" />
      <path d="M7.5 7.5h.01" />
    </>
  ),
};

export default function ModuleIcon({ module, size = 28, color = "currentColor", strokeWidth = 1.7 }: {
  module: ModuleKey; size?: number; color?: string; strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRACES[module]}
    </svg>
  );
}
