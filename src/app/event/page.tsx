import ComingSoon from "@/components/ComingSoon";
import EventHome from "@/components/event/EventHome";
import { SITES } from "@/lib/sites";

/* La section reste construite : c'est l'indicateur `ready` de src/lib/sites.ts
   qui décide si l'on sert l'agenda ou la page d'attente. */
export default function EventPage() {
  return SITES.event.ready ? <EventHome /> : <ComingSoon site="event" />;
}
