/* Animal portraits: grey art in, correctly coloured dog out.

   Every breed is drawn once, in flat neutral grey. The colour is applied here
   from the exact hex the genetics rolled, so what a player sees always matches
   what the profile says beside it. Thirty grey breed images plus seven pattern
   overlays covers all 211 appearances the game can produce.

   Doing it this way rather than generating 211 pictures is not only cheaper.
   An image model asked for "a chocolate Plott Hound" gives you *a* brown dog;
   this gives you #5b3a2a, which is what the page says three lines below it. */

const ART_BASE = "assets/";

/* Multiply is the whole trick. Grey times a colour gives that colour with the
   grey's shading intact, and dark things - outlines, nose, eyes - stay dark
   because a low value times anything is still low. Highlights stay light.
   One pass, no per-pixel work, no masking. */
function tintToCanvas(img, hex, patternImg) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext("2d");
  if (!ctx || !c.width) return null;

  ctx.drawImage(img, 0, 0);

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, c.width, c.height);

  /* The pattern rides on top but only inside the dog, so a brindle swatch does
     not end up striping the background. source-atop clips to what is already
     painted, which at this point is exactly the animal. */
  if (patternImg) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(patternImg, 0, 0, c.width, c.height);
    ctx.globalAlpha = 1;
  }

  /* multiply and fillRect both paint over transparent pixels, so the cut-out
     has to be restored from the original alpha or the dog arrives in a box. */
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(img, 0, 0);

  return c.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const artSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Tinting the same dog on every render would be wasteful and would flicker, so
   finished portraits are kept by a key that captures everything that changes
   one: the art file, the colour and the pattern. */
const portraitCache = new Map();

function portraitKeyFor(kind, animal) {
  const breed = artSlug(animal.breed);
  const genes = animal.colorGenes || {};
  return [kind, breed, genes.base || "none", genes.pattern || "solid"].join("|");
}

function AnimalPortrait({ kind = "dog", animal, width = 280, className = "" }) {
  const [src, setSrc] = useState(null);
  const [missing, setMissing] = useState(false);
  const key = animal ? portraitKeyFor(kind, animal) : null;

  useEffect(() => {
    if (!animal || !key) return;
    let live = true;

    if (portraitCache.has(key)) { setSrc(portraitCache.get(key)); return; }

    const folder = kind === "horse" ? "horses" : kind === "cattle" ? "cattle" : "dogs";
    const genes = animal.colorGenes || {};
    const base = genes.base;
    const pattern = genes.pattern && genes.pattern !== "solid" ? genes.pattern : null;
    const hex = (typeof COLOR_HEX !== "undefined" && COLOR_HEX[base]) || "#c9a06b";

    (async () => {
      /* Check the manifest before asking. A guessed filename that does not exist
         is a 404 in every player's console and an automatic build failure here,
         since the smoke test treats any console error as a break. */
      const rel = `${folder}/${artSlug(animal.breed)}.png`;
      if (typeof hasArt === "function" && !hasArt(rel)) { setMissing(true); return; }

      const img = await loadImage(ART_BASE + rel);
      if (!live) return;
      if (!img) { setMissing(true); return; }

      // Cattle colour is fixed per breed, so their art arrives already painted.
      if (kind === "cattle") {
        portraitCache.set(key, img.src);
        setSrc(img.src);
        return;
      }

      const patRel = `patterns/${pattern}.png`;
      const pat = pattern && (typeof hasArt !== "function" || hasArt(patRel))
        ? await loadImage(ART_BASE + patRel) : null;
      if (!live) return;

      let url;
      try { url = tintToCanvas(img, hex, pat); }
      catch (e) { url = img.src; }   // a tainted canvas is still better than nothing
      if (!live) return;

      portraitCache.set(key, url || img.src);
      setSrc(url || img.src);
    })();

    return () => { live = false; };
  }, [key, kind, animal && animal.breed]);

  if (!animal) return null;

  /* No art for this breed yet. The existing generated swatch is a genuinely
     useful stand-in - it is drawn from the same colour genes - so it stays as
     the fallback rather than a grey box saying "missing". */
  if (missing || !src) {
    if (kind === "dog" && typeof CoatSwatch === "function") {
      return <CoatSwatch dog={animal} width={width} height={Math.round(width * 0.19)} />;
    }
    return <div className="kg-ap__blank" style={{ maxWidth: width }} aria-hidden="true" />;
  }

  return (
    <img className={"kg-portrait " + className} src={src} width={width}
      alt={`${animal.name}, a ${animal.breed}`} loading="lazy" />
  );
}
