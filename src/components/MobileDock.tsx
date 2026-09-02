"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteFromPath } from "@/lib/sites";

type DockItem = {
  href: string;
  label: string;
  paths: string[];
  icon: React.ReactNode;
};

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ITEMS: DockItem[] = [
  {
    href: "/",
    label: "Annonces",
    paths: ["/"],
    icon: <Icon><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6" /></Icon>,
  },
  {
    href: "/food",
    label: "Manger",
    paths: ["/food"],
    icon: <Icon><path d="M7 3v7M4.5 3v5A2.5 2.5 0 0 0 7 10.5V21M9.5 3v5A2.5 2.5 0 0 1 7 10.5" /><path d="M15 3v18M15 3c3.2 1.5 4.5 4 4.5 7H15" /></Icon>,
  },
  {
    href: "/guide",
    label: "Découvrir",
    paths: ["/guide"],
    icon: <Icon><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></Icon>,
  },
  {
    href: "/event",
    label: "Sortir",
    paths: ["/event"],
    icon: <Icon><path d="M5 4v3M19 4v3M4 9h16M5 6h14a1 1 0 0 1 1 1v13H4V7a1 1 0 0 1 1-1Z" /><path d="M8 13h3M13 13h3M8 17h3" /></Icon>,
  },
];

const TOP_LEVEL = new Set(["/", "/food", "/guide", "/event"]);

export default function MobileDock() {
  const pathname = usePathname() ?? "/";
  if (!TOP_LEVEL.has(pathname)) return null;

  return (
    <nav className="mobile-dock" data-site={siteFromPath(pathname)} aria-label="Navigation principale">
      <div className="mobile-dock-inner">
        {ITEMS.slice(0, 2).map((item) => <DockLink key={item.href} item={item} pathname={pathname} />)}
        <Link href="/deposer" className="mobile-dock-publish" aria-label="Déposer une annonce">
          <span aria-hidden="true">+</span>
          <small>Publier</small>
        </Link>
        {ITEMS.slice(2).map((item) => <DockLink key={item.href} item={item} pathname={pathname} />)}
      </div>
    </nav>
  );
}

function DockLink({ item, pathname }: { item: DockItem; pathname: string }) {
  const active = item.paths.includes(pathname);
  return (
    <Link href={item.href} className={`mobile-dock-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}>
      {item.icon}
      <span>{item.label}</span>
    </Link>
  );
}
