"use client";

/* Compression des photos avant envoi.
   Une photo de téléphone pèse 4 à 8 Mo ; le bucket refuse au-delà de 5 Mo :
   sans cette étape, une partie des dépôts échoue silencieusement selon le
   téléphone. Recadrée à 1600 px de grand côté et réencodée, la même photo
   pèse quelques centaines de Ko — et s'affiche pareil sur une fiche. */

const MAX_DIM = 1600;
const QUALITY = 0.82;

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

/* Rend toujours un fichier exploitable : en cas de pépin (format exotique,
   canvas indisponible), l'original part tel quel — un dépôt ne doit jamais
   échouer à cause de l'optimisation. */
export async function compressImage(file: File): Promise<File> {
  try {
    if (!file.type.startsWith("image/")) return file;

    const img = await decode(file);
    const w = "width" in img ? img.width : 0;
    const h = "height" in img ? img.height : 0;
    if (!w || !h) return file;

    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // WebP quand le navigateur sait l'encoder (il rend du PNG sinon), JPEG en repli.
    let blob = await toBlob(canvas, "image/webp", QUALITY);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", QUALITY);
    if (!blob) return file;

    // Si l'original était déjà plus léger (petite image bien encodée), on le garde.
    if (blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  }
}
