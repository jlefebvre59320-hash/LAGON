"use client";

/* Compression des photos avant envoi.
   Une photo de téléphone pèse 4 à 8 Mo ; le bucket refuse au-delà de 5 Mo :
   sans cette étape, une partie des dépôts échoue silencieusement selon le
   téléphone. Recadrée à 1600 px de grand côté et réencodée, la même photo
   pèse quelques centaines de Ko — et s'affiche pareil sur une fiche.

   Chaque photo est aussi déclinée en vignette (480 px, ~30 Ko) : les grilles
   d'annonces en affichent des dizaines à la fois, et servir l'image pleine
   taille dans une case de 300 px gaspille la bande passante du site autant
   que le forfait mobile du visiteur. */

const MAX_DIM = 1600;
const QUALITY = 0.82;

const THUMB_DIM = 480;
const THUMB_QUALITY = 0.72;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Vieux navigateurs : détour par un <img>.
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q));
}

async function resize(
  img: ImageBitmap | HTMLImageElement,
  maxDim: number,
  quality: number
): Promise<{ blob: Blob; ext: string } | null> {
  const w = "width" in img ? img.width : 0;
  const h = "height" in img ? img.height : 0;
  if (!w || !h) return null;

  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // WebP quand le navigateur sait l'encoder (il rend du PNG sinon), JPEG en repli.
  let blob = await toBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
  if (!blob) return null;

  return { blob, ext: blob.type === "image/webp" ? "webp" : "jpg" };
}

/* Rend toujours un fichier exploitable : en cas de pépin (format exotique,
   canvas indisponible), l'original part tel quel — un dépôt ne doit jamais
   échouer à cause de l'optimisation. La vignette, elle, peut manquer : les
   affichages retombent alors sur l'image pleine taille. */
export async function compressImage(file: File): Promise<{ full: File; thumb: File | null }> {
  try {
    if (!file.type.startsWith("image/")) return { full: file, thumb: null };

    const img = await decode(file);

    const big = await resize(img, MAX_DIM, QUALITY);
    const small = await resize(img, THUMB_DIM, THUMB_QUALITY);

    const base = file.name.replace(/\.[^.]+$/, "");

    // Si l'original était déjà plus léger (petite image bien encodée), on le garde.
    const full = big && big.blob.size < file.size
      ? new File([big.blob], `${base}.${big.ext}`, { type: big.blob.type })
      : file;

    const thumb = small
      ? new File([small.blob], `${base}.thumb.${small.ext}`, { type: small.blob.type })
      : null;

    return { full, thumb };
  } catch {
    return { full: file, thumb: null };
  }
}

/* Clé de la vignette déduite de celle de l'image : « 0.webp » → « 0.thumb.webp ».
   Une convention plutôt qu'une colonne — les photos déposées avant l'arrivée
   des vignettes n'en ont pas, et l'affichage le gère par un repli. */
export function thumbKey(key: string) {
  return key.replace(/\.([^.]+)$/, ".thumb.$1");
}
