import GuideHome from "@/components/guide/GuideHome";
import ComingSoon from "@/components/ComingSoon";
import { SITES } from "@/lib/sites";

/* Tant que la section est mise de côté (ready = false), on sert la page
   d'attente ; le guide et ses fiches restent en place pour la réouverture. */
export default function GuidePage() {
  return SITES.guide.ready ? <GuideHome /> : <ComingSoon site="guide" />;
}
