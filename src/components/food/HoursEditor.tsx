"use client";
import { DAY_LABEL, DAY_ORDER, type DayKey, type HoursMap } from "@/lib/food";

/* Éditeur d'horaires : jusqu'à deux créneaux par jour (midi et soir), en
   champs heure natifs — le clavier-roulette du téléphone vaut mieux que du
   texte libre à interpréter. Un jour sans créneau = fermé. */
export default function HoursEditor({
  value,
  onChange,
}: {
  value: HoursMap;
  onChange: (h: HoursMap) => void;
}) {
  const slotsOf = (d: DayKey) => value[d] ?? [];

  const write = (d: DayKey, slots: [string, string][]) => {
    const next = { ...value };
    if (slots.length === 0) delete next[d];
    else next[d] = slots;
    onChange(next);
  };

  const setTime = (d: DayKey, i: number, pos: 0 | 1, v: string) => {
    const slots = slotsOf(d).map((s, j) => (j === i ? ([...s] as [string, string]) : s));
    slots[i][pos] = v;
    write(d, slots);
  };

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      {DAY_ORDER.map((d, di) => {
        const slots = slotsOf(d);
        return (
          <div
            key={d}
            style={{
              display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
              padding: "10px 12px",
              borderTop: di === 0 ? "none" : "1px solid var(--border)",
            }}
          >
            <span style={{ flex: "0 0 82px", fontSize: 13, fontWeight: 600 }}>{DAY_LABEL[d]}</span>

            {slots.length === 0 && (
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Fermé</span>
            )}

            {slots.map(([start, end], i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <input
                  type="time" className="input" value={start}
                  onChange={(e) => setTime(d, i, 0, e.target.value)}
                  aria-label={`${DAY_LABEL[d]} : ouverture du créneau ${i + 1}`}
                  style={{ width: 96, minHeight: 38, padding: "6px 8px" }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>–</span>
                <input
                  type="time" className="input" value={end}
                  onChange={(e) => setTime(d, i, 1, e.target.value)}
                  aria-label={`${DAY_LABEL[d]} : fermeture du créneau ${i + 1}`}
                  style={{ width: 96, minHeight: 38, padding: "6px 8px" }}
                />
                <button
                  type="button" className="link-quiet"
                  onClick={() => write(d, slots.filter((_, j) => j !== i))}
                  aria-label={`Supprimer le créneau ${i + 1} de ${DAY_LABEL[d]}`}
                  style={{ fontSize: 15, textDecoration: "none", padding: "0 4px" }}
                >
                  ×
                </button>
              </span>
            ))}

            {slots.length < 2 && (
              <button
                type="button" className="link-quiet"
                onClick={() => write(d, [...slots, ["", ""]])}
                style={{ fontSize: 12.5 }}
              >
                + créneau
              </button>
            )}
          </div>
        );
      })}
      <div style={{ padding: "8px 12px", fontSize: 11.5, color: "var(--text-muted)", background: "var(--cream)" }}>
        Un service qui finit après minuit se note tel quel (ex. 19:00 – 01:00).
      </div>
    </div>
  );
}
