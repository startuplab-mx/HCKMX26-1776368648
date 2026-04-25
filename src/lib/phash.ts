// Lightweight average-hash (aHash) — runs entirely in the browser.
// Produces a 64-bit perceptual fingerprint as a 16-char hex string.
// Two near-identical images differ by a small Hamming distance.
//
// This is intentionally a tiny demo implementation — production sextortion
// blocklists would use PhotoDNA / pdqhash on a server, but aHash is enough
// to prove the "image already known to be harmful" UX in the hackathon.

export async function perceptualHashFromDataUrl(
  dataUrl: string,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Convert to grayscale and average
  const gray: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray.push(g);
    sum += g;
  }
  const avg = sum / gray.length;

  // Build 64-bit hash: 1 if pixel >= avg, else 0
  let hex = "";
  for (let nibble = 0; nibble < 16; nibble++) {
    let v = 0;
    for (let bit = 0; bit < 4; bit++) {
      const idx = nibble * 4 + bit;
      if (gray[idx] >= avg) v |= 1 << (3 - bit);
    }
    hex += v.toString(16);
  }
  return hex;
}

export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length) * 4;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
