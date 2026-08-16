/* Remonté à chaque navigation (contrairement au layout) : c'est ce qui
   rejoue l'animation d'entrée de page à chaque changement d'écran. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
