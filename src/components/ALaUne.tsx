"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import type { Listing } from "@/lib/types";

/* « À la une » : les annonces mises en avant, en tête de l'accueil, dans
   une rangée qui glisse au doigt et avance seule, lentement.

   Les règles qui évitent les défauts habituels des carrousels :
   · il n'apparaît qu'à partir de trois annonces — à une ou deux, la grille
     suffit et un bandeau presque vide fait pauvre ;
   · le défilement automatique est lent (six secondes), s'arrête dès qu'on
     touche, survole ou met le focus dans la rangée, et ne repart qu'après
     un moment de calme ; il ne démarre jamais si le système demande moins
     d'animations, ni quand l'onglet n'est pas visible ;
   · les annonces montrées ici sortent de la grille en dessous — on ne fait
     pas passer deux fois la même chose sous les yeux ;
   · on avance en faisant glisser la rangée, jamais en cachant ou montrant
     des éléments : le contenu reste entier, lisible, cliquable. */

const INTERVALLE_MS = 6000;
const REPRISE_MS = 12000;

export default function ALaUne({ annonces }: { annonces: Listing[] }) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [enPause, setEnPause] = useState(false);
  const reprise = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animer, setAnimer] = useState(false);

  /* Le réglage système « réduire les animations » désactive le défilement
     automatique, point. La rangée reste glissable à la main. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const maj = () => setAnimer(!mq.matches);
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);

  const allerA = useCallback((i: number, doux = true) => {
    const p = piste.current;
    if (!p) return;
    const cartes = Array.from(p.children) as HTMLElement[];
    if (cartes.length === 0) return;
    const cible = ((i % cartes.length) + cartes.length) % cartes.length;
    const c = cartes[cible];
    p.scrollTo({ left: c.offsetLeft - p.offsetLeft, behavior: doux ? "smooth" : "auto" });
  }, []);

  /* L'index affiché suit ce qui est réellement à l'écran, y compris après
     un glissement au doigt : on lit la position de défilement, pas un
     compteur interne qui se désynchroniserait. */
  useEffect(() => {
    const p = piste.current;
    if (!p) return;
    let raf = 0;
    const lire = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        /* La carte « courante » est la première entièrement visible à
           gauche : sur un grand écran où plusieurs cartes tiennent, le
           compteur dit alors « 1 / 4 » et non un chiffre du milieu. */
        const cartes = Array.from(p.children) as HTMLElement[];
        const x = p.scrollLeft;
        let meilleur = 0;
        cartes.forEach((c, i) => {
          const gauche = c.offsetLeft - p.offsetLeft;
          if (gauche <= x + c.offsetWidth * 0.4) meilleur = i;
        });
        setIndex(meilleur);
      });
    };
    p.addEventListener("scroll", lire, { passive: true });
    return () => { p.removeEventListener("scroll", lire); cancelAnimationFrame(raf); };
  }, [annonces.length]);

  /* La pause : toute interaction l'enclenche, et elle se lève seule après
     douze secondes sans rien — le temps de lire une carte. */
  const toucher = useCallback(() => {
    setEnPause(true);
    if (reprise.current) clearTimeout(reprise.current);
    reprise.current = setTimeout(() => setEnPause(false), REPRISE_MS);
  }, []);
  useEffect(() => () => { if (reprise.current) clearTimeout(reprise.current); }, []);

  useEffect(() => {
    if (!animer || enPause || annonces.length < 2) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      const p = piste.current;
      if (!p) return;
      /* Si la rangée tient entièrement à l'écran, il n'y a rien à faire
         défiler : on ne bouge pas pour bouger. */
      if (p.scrollWidth <= p.clientWidth + 8) return;
      /* Arrivé au bout, on repart au début plutôt que de buter contre la
         fin : sur grand écran, les dernières cartes sont déjà visibles. */
      const fin = p.scrollLeft >= p.scrollWidth - p.clientWidth - 4;
      allerA(fin ? 0 : index + 1);
    }, INTERVALLE_MS);
    return () => clearInterval(id);
  }, [animer, enPause, index, annonces.length, allerA]);

  if (annonces.length === 0) return null;

  return (
    <section className="une-section" aria-label="Annonces à la une"
      onMouseEnter={toucher} onFocusCapture={toucher} onTouchStart={toucher} onPointerDown={toucher}>
      <div className="une-tete">
        <h2 className="une-titre">
          <span className="une-etoile" aria-hidden="true">★</span>
          À la une
          <span className="une-compte">{index + 1} / {annonces.length}</span>
        </h2>
        <Link href="/deposer" className="une-lien">
          <span className="une-lien-long">Mettre mon annonce en avant →</span>
          <span className="une-lien-court">Mettre en avant →</span>
        </Link>
      </div>

      <div className="une-cadre">
        <button type="button" className="une-fleche une-gauche" aria-label="Annonce précédente"
          onClick={() => { toucher(); allerA(index - 1); }}>‹</button>
        <div className="une-piste no-scrollbar" ref={piste}>
          {annonces.map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
        <button type="button" className="une-fleche une-droite" aria-label="Annonce suivante"
          onClick={() => { toucher(); allerA(index + 1); }}>›</button>
      </div>

      <div className="une-points" role="tablist" aria-label="Position dans les annonces à la une">
        {annonces.map((l, i) => (
          <button key={l.id} type="button" role="tab" aria-selected={i === index}
            aria-label={`Annonce ${i + 1} sur ${annonces.length}`}
            className={i === index ? "actif" : ""}
            onClick={() => { toucher(); allerA(i); }} />
        ))}
      </div>
    </section>
  );
}
