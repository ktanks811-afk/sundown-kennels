# Art brief — Sundown Kennels Simulator

Generated from the game's own data tables by `scripts/make-art-prompts.mjs`.
Re-run that script after adding breeds or items and this file regenerates.

---

## The style, and why

**Flat vector illustration. Not photoreal, not cartoon-goofy.**

Four reasons, in order of how much they matter:

1. **It stays coherent across hundreds of images.** Photoreal AI animals drift badly
   between generations — different lighting, different camera, different level of
   detail. Two hundred photoreal dogs will not look like they belong to one game.
   Flat art with a fixed brief holds together.
2. **Flat colour areas can be tinted precisely.** This is what makes the image
   actually match the description — see the plan below.
3. **It matches the item icons already in the game**, which are flat SVG with a
   chunky outline.
4. **It reads at 200px on a card.** Photoreal detail is wasted at the size these
   are actually displayed.

Every prompt below should be prefixed with this style line:

```
Flat vector illustration, clean thick dark outline, limited flat colour areas, subtle cel shading only. Strict left-facing side profile, standing square, whole animal in frame, hooves/paws on an invisible ground line. Transparent background. No scenery, no text, no shadow on the ground, no border. Warm earthy palette. Friendly and characterful but anatomically honest - a working animal, not a mascot. Consistent camera distance and proportion across every image in the set.
```

---

## The important decision: how the image matches the dog

The game can roll **211 distinct dog appearances** (breed × base colour ×
coat pattern). Generating all of them is possible but it is the wrong shape of work,
because an AI asked for "a chocolate Plott Hound" will give you *a* brown dog, not
the exact `#5b3a2a` the genetics rolled. The picture would be approximately right,
which on a page that also prints the exact colour name reads as a bug.

**Recommended: generate breed × pattern, tint the colour at runtime.**

- Patterns are structural — brindle striping, piebald patches, merle mottling, a
  saddle marking. Those need real art.
- Base colour is a flat fill. The game already knows the exact hex it rolled
  (`COLOR_HEX` in `data.jsx`), so it can recolour a flat coat region exactly.
- That turns **211 images into 66** — and the colour is then
  *guaranteed* to match the description rather than approximately matching it.

For this to work, each image needs the coat as **one flat fill area in a neutral
mid-grey**, with markings, nose, eyes and outline on top in fixed colours. Say so in
the prompt — it is included below.

If you would rather not do the tinting work, Tier 2b lists all
211 colour-specific prompts instead. Both are here; use one or the other.

---

## Tier 1 — one hero image per breed (59 images)

Start here. Gets a breed-correct picture on every animal in the game. Colour will
not match yet, but breed, build and size will — which is most of what a player reads.

### Dogs (30)

- `dogs/american-pit-bull-terrier.png` — **American Pit Bull Terrier** (Bull & Terrier). Adult male in working
  condition, 18–21 in at the shoulder, 35–60 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/catahoula-leopard-dog.png` — **Catahoula Leopard Dog** (Curs & Feists). Adult male in working
  condition, 22–24 in at the shoulder, 50–95 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/black-mouth-cur.png` — **Black Mouth Cur** (Curs & Feists). Adult male in working
  condition, 18–25 in at the shoulder, 50–95 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/blue-lacy.png` — **Blue Lacy** (Curs & Feists). Adult male in working
  condition, 18–21 in at the shoulder, 35–55 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/plott-hound.png` — **Plott Hound** (Treeing Hounds). Adult male in working
  condition, 20–25 in at the shoulder, 50–60 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/mountain-cur.png` — **Mountain Cur** (Curs & Feists). Adult male in working
  condition, 18–26 in at the shoulder, 30–60 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/american-bulldog.png` — **American Bulldog** (Working Bulldogs). Adult male in working
  condition, 22–28 in at the shoulder, 70–120 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/american-leopard-hound.png` — **American Leopard Hound** (Curs & Feists). Adult male in working
  condition, 21–27 in at the shoulder, 35–75 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/treeing-walker-coonhound.png` — **Treeing Walker Coonhound** (Treeing Hounds). Adult male in working
  condition, 22–27 in at the shoulder, 55–70 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/redbone-coonhound.png` — **Redbone Coonhound** (Treeing Hounds). Adult male in working
  condition, 22–27 in at the shoulder, 50–70 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/bluetick-coonhound.png` — **Bluetick Coonhound** (Treeing Hounds). Adult male in working
  condition, 21–27 in at the shoulder, 55–80 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/dogo-argentino.png` — **Dogo Argentino** (Working Bulldogs). Adult male in working
  condition, 24–26.5 in at the shoulder, 88–100 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/cane-corso.png` — **Cane Corso** (Working Bulldogs). Adult male in working
  condition, 24–27.5 in at the shoulder, 95–110 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/airedale-terrier.png` — **Airedale Terrier** (Bull & Terrier). Adult male in working
  condition, 22–24 in at the shoulder, 50–70 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/american-staffordshire-terrier.png` — **American Staffordshire Terrier** (Bull & Terrier). Adult male in working
  condition, 18–19 in at the shoulder, 55–70 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/staffordshire-bull-terrier.png` — **Staffordshire Bull Terrier** (Bull & Terrier). Adult male in working
  condition, 14–16 in at the shoulder, 28–38 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/american-bully.png` — **American Bully** (Bull & Terrier). Adult male in working
  condition, 17–20 in at the shoulder, 65–110 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/patterdale-terrier.png` — **Patterdale Terrier** (Bull & Terrier). Adult male in working
  condition, 12–15 in at the shoulder, 11–13 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/jagdterrier.png` — **Jagdterrier** (Bull & Terrier). Adult male in working
  condition, 13–16 in at the shoulder, 17–22 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/mountain-feist.png` — **Mountain Feist** (Curs & Feists). Adult male in working
  condition, 12–18 in at the shoulder, 12–30 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/black-and-tan-coonhound.png` — **Black and Tan Coonhound** (Treeing Hounds). Adult male in working
  condition, 25–27 in at the shoulder, 65–110 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/english-coonhound.png` — **English Coonhound** (Treeing Hounds). Adult male in working
  condition, 22–27 in at the shoulder, 45–65 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/majestic-tree-hound.png` — **Majestic Tree Hound** (Treeing Hounds). Adult male in working
  condition, 25–30 in at the shoulder, 75–110 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/presa-canario.png` — **Presa Canario** (Working Bulldogs). Adult male in working
  condition, 23–26 in at the shoulder, 100–130 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/boerboel.png` — **Boerboel** (Working Bulldogs). Adult male in working
  condition, 24–27 in at the shoulder, 150–200 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/dogue-de-bordeaux.png` — **Dogue de Bordeaux** (Working Bulldogs). Adult male in working
  condition, 23–27 in at the shoulder, 110–145 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/rhodesian-ridgeback.png` — **Rhodesian Ridgeback** (Gundogs). Adult male in working
  condition, 25–27 in at the shoulder, 79–90 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/carolina-dog.png` — **Carolina Dog** (Curs & Feists). Adult male in working
  condition, 17–24 in at the shoulder, 30–55 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/german-shorthaired-pointer.png` — **German Shorthaired Pointer** (Gundogs). Adult male in working
  condition, 23–25 in at the shoulder, 55–70 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.
- `dogs/beagle.png` — **Beagle** (Treeing Hounds). Adult male in working
  condition, 13–15 in at the shoulder, 20–30 lb. Coat as ONE flat mid-grey fill for tinting;
  keep nose, eyes, claws and outline dark and unaffected.

### Horses (15)

- `horses/quarter-horse.png` — **Quarter Horse**, 14.3–16 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/thoroughbred.png` — **Thoroughbred**, 15.2–17 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/arabian.png` — **Arabian**, 14.1–15.1 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/appaloosa.png` — **Appaloosa**, 14.2–15.2 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/paint-horse.png` — **Paint Horse**, 14.2–16 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/mustang.png` — **Mustang**, 13.2–15 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/andalusian.png` — **Andalusian**, 15–16.2 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/friesian.png` — **Friesian**, 15.3–17 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/tennessee-walking-horse.png` — **Tennessee Walking Horse**, 14.3–17 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/morgan.png` — **Morgan**, 14.1–15.2 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/standardbred.png` — **Standardbred**, 15–16.2 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/clydesdale.png` — **Clydesdale**, 16.2–18 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/percheron.png` — **Percheron**, 16–18 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/belgian-draft.png` — **Belgian Draft**, 16.2–18 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.
- `horses/miniature-horse.png` — **Miniature Horse**, 7–8.2 hands. Adult, tacked
  up in nothing, standing square. Body as ONE flat mid-grey fill for tinting; mane,
  tail, hooves and outline fixed dark.

### Cattle (14)

- `cattle/angus.png` — **Angus**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Black
  (solid); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/red-angus.png` — **Red Angus**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Red
  (solid); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/hereford.png` — **Hereford**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Red
  (whiteface); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/charolais.png` — **Charolais**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is White
  (solid); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/simmental.png` — **Simmental**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Red & White
  (pied); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/limousin.png` — **Limousin**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Golden Red
  (solid); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/brahman.png` — **Brahman**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Light Grey
  (solid); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/texas-longhorn.png` — **Texas Longhorn**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Varies
  (varies); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/highland.png` — **Highland**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Red
  (shaggy); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/galloway.png` — **Galloway**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Black
  (shaggy); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/belted-galloway.png` — **Belted Galloway**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Black w/ White Belt
  (belted); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/wagyu.png` — **Wagyu**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Black
  (solid); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/shorthorn.png` — **Shorthorn**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Roan
  (roanCapable); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.
- `cattle/holstein.png` — **Holstein**, mature animal.
  Breed-correct horns and build. Standard colour for the breed is Black & White
  (pied); paint it that way rather than grey — cattle colour is
  fixed per breed in this game, so these do not need tinting.

---

## Tier 2a — dog coat patterns (66 images) — RECOMMENDED

One per breed × pattern, coat in neutral grey, tinted at runtime. Combined with
Tier 1 this covers all 211 appearances exactly.

**American Pit Bull Terrier** — 3 patterns
- `dogs/american-pit-bull-terrier--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-pit-bull-terrier--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-pit-bull-terrier--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Catahoula Leopard Dog** — 3 patterns
- `dogs/catahoula-leopard-dog--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/catahoula-leopard-dog--merle.png` — mottled merle — irregular lighter torn-edge patches over the base, one blue eye. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/catahoula-leopard-dog--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Black Mouth Cur** — 2 patterns
- `dogs/black-mouth-cur--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/black-mouth-cur--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Blue Lacy** — 1 pattern
- `dogs/blue-lacy--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Plott Hound** — 3 patterns
- `dogs/plott-hound--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/plott-hound--saddle.png` — a darker saddle marking over the back and sides, lighter legs and face. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/plott-hound--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Mountain Cur** — 3 patterns
- `dogs/mountain-cur--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/mountain-cur--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/mountain-cur--merle.png` — mottled merle — irregular lighter torn-edge patches over the base, one blue eye. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**American Bulldog** — 3 patterns
- `dogs/american-bulldog--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-bulldog--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-bulldog--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**American Leopard Hound** — 3 patterns
- `dogs/american-leopard-hound--merle.png` — mottled merle — irregular lighter torn-edge patches over the base, one blue eye. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-leopard-hound--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-leopard-hound--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Treeing Walker Coonhound** — 2 patterns
- `dogs/treeing-walker-coonhound--tricolor.png` — black saddle, tan points on face and legs, white chest and feet. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/treeing-walker-coonhound--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Redbone Coonhound** — 1 pattern
- `dogs/redbone-coonhound--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Bluetick Coonhound** — 2 patterns
- `dogs/bluetick-coonhound--ticked.png` — fine speckled ticking scattered over white areas. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/bluetick-coonhound--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Dogo Argentino** — 1 pattern
- `dogs/dogo-argentino--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Cane Corso** — 2 patterns
- `dogs/cane-corso--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/cane-corso--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Airedale Terrier** — 1 pattern
- `dogs/airedale-terrier--saddle.png` — a darker saddle marking over the back and sides, lighter legs and face. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**American Staffordshire Terrier** — 3 patterns
- `dogs/american-staffordshire-terrier--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-staffordshire-terrier--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-staffordshire-terrier--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Staffordshire Bull Terrier** — 3 patterns
- `dogs/staffordshire-bull-terrier--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/staffordshire-bull-terrier--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/staffordshire-bull-terrier--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**American Bully** — 3 patterns
- `dogs/american-bully--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-bully--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/american-bully--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Patterdale Terrier** — 2 patterns
- `dogs/patterdale-terrier--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/patterdale-terrier--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Jagdterrier** — 2 patterns
- `dogs/jagdterrier--saddle.png` — a darker saddle marking over the back and sides, lighter legs and face. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/jagdterrier--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Mountain Feist** — 3 patterns
- `dogs/mountain-feist--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/mountain-feist--tricolor.png` — black saddle, tan points on face and legs, white chest and feet. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/mountain-feist--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Black and Tan Coonhound** — 2 patterns
- `dogs/black-and-tan-coonhound--saddle.png` — a darker saddle marking over the back and sides, lighter legs and face. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/black-and-tan-coonhound--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**English Coonhound** — 3 patterns
- `dogs/english-coonhound--ticked.png` — fine speckled ticking scattered over white areas. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/english-coonhound--tricolor.png` — black saddle, tan points on face and legs, white chest and feet. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/english-coonhound--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Majestic Tree Hound** — 3 patterns
- `dogs/majestic-tree-hound--saddle.png` — a darker saddle marking over the back and sides, lighter legs and face. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/majestic-tree-hound--tricolor.png` — black saddle, tan points on face and legs, white chest and feet. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/majestic-tree-hound--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Presa Canario** — 2 patterns
- `dogs/presa-canario--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/presa-canario--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Boerboel** — 2 patterns
- `dogs/boerboel--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/boerboel--brindle.png` — tiger-striped brindle over the whole body, stripes darker than the base. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Dogue de Bordeaux** — 1 pattern
- `dogs/dogue-de-bordeaux--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Rhodesian Ridgeback** — 1 pattern
- `dogs/rhodesian-ridgeback--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Carolina Dog** — 2 patterns
- `dogs/carolina-dog--solid.png` — one even coat, no markings. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/carolina-dog--saddle.png` — a darker saddle marking over the back and sides, lighter legs and face. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**German Shorthaired Pointer** — 2 patterns
- `dogs/german-shorthaired-pointer--ticked.png` — fine speckled ticking scattered over white areas. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/german-shorthaired-pointer--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

**Beagle** — 2 patterns
- `dogs/beagle--tricolor.png` — black saddle, tan points on face and legs, white chest and feet. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.
- `dogs/beagle--piebald.png` — large irregular white patches over roughly 40% of the body, hard edges. Base coat as one flat mid-grey
  fill; markings a fixed darker grey so both tint together predictably.

---

## Tier 2b — every dog appearance spelled out (211 images) — ALTERNATIVE

Use this **instead of** Tier 2a if you would rather not do runtime tinting. Colour
will be approximate rather than exact.

- `dogs/american-pit-bull-terrier--black--solid.png` — black American Pit Bull Terrier, solid coat.
- `dogs/american-pit-bull-terrier--black--brindle.png` — black American Pit Bull Terrier, brindle coat.
- `dogs/american-pit-bull-terrier--black--piebald.png` — black American Pit Bull Terrier, piebald coat.
- `dogs/american-pit-bull-terrier--blue--solid.png` — blue American Pit Bull Terrier, solid coat.
- `dogs/american-pit-bull-terrier--blue--brindle.png` — blue American Pit Bull Terrier, brindle coat.
- `dogs/american-pit-bull-terrier--blue--piebald.png` — blue American Pit Bull Terrier, piebald coat.
- `dogs/american-pit-bull-terrier--red--solid.png` — red American Pit Bull Terrier, solid coat.
- `dogs/american-pit-bull-terrier--red--brindle.png` — red American Pit Bull Terrier, brindle coat.
- `dogs/american-pit-bull-terrier--red--piebald.png` — red American Pit Bull Terrier, piebald coat.
- `dogs/american-pit-bull-terrier--fawn--solid.png` — fawn American Pit Bull Terrier, solid coat.
- `dogs/american-pit-bull-terrier--fawn--brindle.png` — fawn American Pit Bull Terrier, brindle coat.
- `dogs/american-pit-bull-terrier--fawn--piebald.png` — fawn American Pit Bull Terrier, piebald coat.
- `dogs/american-pit-bull-terrier--chocolate--solid.png` — chocolate American Pit Bull Terrier, solid coat.
- `dogs/american-pit-bull-terrier--chocolate--brindle.png` — chocolate American Pit Bull Terrier, brindle coat.
- `dogs/american-pit-bull-terrier--chocolate--piebald.png` — chocolate American Pit Bull Terrier, piebald coat.
- `dogs/american-pit-bull-terrier--white--solid.png` — white American Pit Bull Terrier, solid coat.
- `dogs/american-pit-bull-terrier--white--brindle.png` — white American Pit Bull Terrier, brindle coat.
- `dogs/american-pit-bull-terrier--white--piebald.png` — white American Pit Bull Terrier, piebald coat.
- `dogs/catahoula-leopard-dog--black--solid.png` — black Catahoula Leopard Dog, solid coat.
- `dogs/catahoula-leopard-dog--black--merle.png` — black Catahoula Leopard Dog, merle coat.
- `dogs/catahoula-leopard-dog--black--brindle.png` — black Catahoula Leopard Dog, brindle coat.
- `dogs/catahoula-leopard-dog--red--solid.png` — red Catahoula Leopard Dog, solid coat.
- `dogs/catahoula-leopard-dog--red--merle.png` — red Catahoula Leopard Dog, merle coat.
- `dogs/catahoula-leopard-dog--red--brindle.png` — red Catahoula Leopard Dog, brindle coat.
- `dogs/catahoula-leopard-dog--blue--solid.png` — blue Catahoula Leopard Dog, solid coat.
- `dogs/catahoula-leopard-dog--blue--merle.png` — blue Catahoula Leopard Dog, merle coat.
- `dogs/catahoula-leopard-dog--blue--brindle.png` — blue Catahoula Leopard Dog, brindle coat.
- `dogs/black-mouth-cur--red--solid.png` — red Black Mouth Cur, solid coat.
- `dogs/black-mouth-cur--red--brindle.png` — red Black Mouth Cur, brindle coat.
- `dogs/black-mouth-cur--fawn--solid.png` — fawn Black Mouth Cur, solid coat.
- `dogs/black-mouth-cur--fawn--brindle.png` — fawn Black Mouth Cur, brindle coat.
- `dogs/black-mouth-cur--yellow--solid.png` — yellow Black Mouth Cur, solid coat.
- `dogs/black-mouth-cur--yellow--brindle.png` — yellow Black Mouth Cur, brindle coat.
- `dogs/black-mouth-cur--black--solid.png` — black Black Mouth Cur, solid coat.
- `dogs/black-mouth-cur--black--brindle.png` — black Black Mouth Cur, brindle coat.
- `dogs/blue-lacy--blue--solid.png` — blue Blue Lacy, solid coat.
- `dogs/blue-lacy--red--solid.png` — red Blue Lacy, solid coat.
- `dogs/blue-lacy--tricolor--solid.png` — tricolor Blue Lacy, solid coat.
- `dogs/plott-hound--buckskin--brindle.png` — buckskin Plott Hound, brindle coat.
- `dogs/plott-hound--buckskin--saddle.png` — buckskin Plott Hound, saddle coat.
- `dogs/plott-hound--buckskin--solid.png` — buckskin Plott Hound, solid coat.
- `dogs/plott-hound--black--brindle.png` — black Plott Hound, brindle coat.
- `dogs/plott-hound--black--saddle.png` — black Plott Hound, saddle coat.
- `dogs/plott-hound--black--solid.png` — black Plott Hound, solid coat.
- `dogs/mountain-cur--yellow--brindle.png` — yellow Mountain Cur, brindle coat.
- `dogs/mountain-cur--yellow--solid.png` — yellow Mountain Cur, solid coat.
- `dogs/mountain-cur--yellow--merle.png` — yellow Mountain Cur, merle coat.
- `dogs/mountain-cur--black--brindle.png` — black Mountain Cur, brindle coat.
- `dogs/mountain-cur--black--solid.png` — black Mountain Cur, solid coat.
- `dogs/mountain-cur--black--merle.png` — black Mountain Cur, merle coat.
- `dogs/mountain-cur--blue--brindle.png` — blue Mountain Cur, brindle coat.
- `dogs/mountain-cur--blue--solid.png` — blue Mountain Cur, solid coat.
- `dogs/mountain-cur--blue--merle.png` — blue Mountain Cur, merle coat.
- `dogs/american-bulldog--white--piebald.png` — white American Bulldog, piebald coat.
- `dogs/american-bulldog--white--brindle.png` — white American Bulldog, brindle coat.
- `dogs/american-bulldog--white--solid.png` — white American Bulldog, solid coat.
- `dogs/american-bulldog--red--piebald.png` — red American Bulldog, piebald coat.
- `dogs/american-bulldog--red--brindle.png` — red American Bulldog, brindle coat.
- `dogs/american-bulldog--red--solid.png` — red American Bulldog, solid coat.
- `dogs/american-bulldog--black--piebald.png` — black American Bulldog, piebald coat.
- `dogs/american-bulldog--black--brindle.png` — black American Bulldog, brindle coat.
- `dogs/american-bulldog--black--solid.png` — black American Bulldog, solid coat.
- `dogs/american-leopard-hound--blue--merle.png` — blue American Leopard Hound, merle coat.
- `dogs/american-leopard-hound--blue--brindle.png` — blue American Leopard Hound, brindle coat.
- `dogs/american-leopard-hound--blue--solid.png` — blue American Leopard Hound, solid coat.
- `dogs/american-leopard-hound--black--merle.png` — black American Leopard Hound, merle coat.
- `dogs/american-leopard-hound--black--brindle.png` — black American Leopard Hound, brindle coat.
- `dogs/american-leopard-hound--black--solid.png` — black American Leopard Hound, solid coat.
- `dogs/american-leopard-hound--red--merle.png` — red American Leopard Hound, merle coat.
- `dogs/american-leopard-hound--red--brindle.png` — red American Leopard Hound, brindle coat.
- `dogs/american-leopard-hound--red--solid.png` — red American Leopard Hound, solid coat.
- `dogs/american-leopard-hound--yellow--merle.png` — yellow American Leopard Hound, merle coat.
- `dogs/american-leopard-hound--yellow--brindle.png` — yellow American Leopard Hound, brindle coat.
- `dogs/american-leopard-hound--yellow--solid.png` — yellow American Leopard Hound, solid coat.
- `dogs/treeing-walker-coonhound--black--tricolor.png` — black Treeing Walker Coonhound, tricolor coat.
- `dogs/treeing-walker-coonhound--black--piebald.png` — black Treeing Walker Coonhound, piebald coat.
- `dogs/treeing-walker-coonhound--tan--tricolor.png` — tan Treeing Walker Coonhound, tricolor coat.
- `dogs/treeing-walker-coonhound--tan--piebald.png` — tan Treeing Walker Coonhound, piebald coat.
- `dogs/redbone-coonhound--red--solid.png` — red Redbone Coonhound, solid coat.
- `dogs/bluetick-coonhound--blue--ticked.png` — blue Bluetick Coonhound, ticked coat.
- `dogs/bluetick-coonhound--blue--solid.png` — blue Bluetick Coonhound, solid coat.
- `dogs/bluetick-coonhound--black--ticked.png` — black Bluetick Coonhound, ticked coat.
- `dogs/bluetick-coonhound--black--solid.png` — black Bluetick Coonhound, solid coat.
- `dogs/dogo-argentino--white--solid.png` — white Dogo Argentino, solid coat.
- `dogs/cane-corso--black--solid.png` — black Cane Corso, solid coat.
- `dogs/cane-corso--black--brindle.png` — black Cane Corso, brindle coat.
- `dogs/cane-corso--blue--solid.png` — blue Cane Corso, solid coat.
- `dogs/cane-corso--blue--brindle.png` — blue Cane Corso, brindle coat.
- `dogs/cane-corso--fawn--solid.png` — fawn Cane Corso, solid coat.
- `dogs/cane-corso--fawn--brindle.png` — fawn Cane Corso, brindle coat.
- `dogs/cane-corso--red--solid.png` — red Cane Corso, solid coat.
- `dogs/cane-corso--red--brindle.png` — red Cane Corso, brindle coat.
- `dogs/airedale-terrier--tan--saddle.png` — tan Airedale Terrier, saddle coat.
- `dogs/american-staffordshire-terrier--blue--solid.png` — blue American Staffordshire Terrier, solid coat.
- `dogs/american-staffordshire-terrier--blue--brindle.png` — blue American Staffordshire Terrier, brindle coat.
- `dogs/american-staffordshire-terrier--blue--piebald.png` — blue American Staffordshire Terrier, piebald coat.
- `dogs/american-staffordshire-terrier--black--solid.png` — black American Staffordshire Terrier, solid coat.
- `dogs/american-staffordshire-terrier--black--brindle.png` — black American Staffordshire Terrier, brindle coat.
- `dogs/american-staffordshire-terrier--black--piebald.png` — black American Staffordshire Terrier, piebald coat.
- `dogs/american-staffordshire-terrier--red--solid.png` — red American Staffordshire Terrier, solid coat.
- `dogs/american-staffordshire-terrier--red--brindle.png` — red American Staffordshire Terrier, brindle coat.
- `dogs/american-staffordshire-terrier--red--piebald.png` — red American Staffordshire Terrier, piebald coat.
- `dogs/american-staffordshire-terrier--fawn--solid.png` — fawn American Staffordshire Terrier, solid coat.
- `dogs/american-staffordshire-terrier--fawn--brindle.png` — fawn American Staffordshire Terrier, brindle coat.
- `dogs/american-staffordshire-terrier--fawn--piebald.png` — fawn American Staffordshire Terrier, piebald coat.
- `dogs/staffordshire-bull-terrier--red--solid.png` — red Staffordshire Bull Terrier, solid coat.
- `dogs/staffordshire-bull-terrier--red--brindle.png` — red Staffordshire Bull Terrier, brindle coat.
- `dogs/staffordshire-bull-terrier--red--piebald.png` — red Staffordshire Bull Terrier, piebald coat.
- `dogs/staffordshire-bull-terrier--fawn--solid.png` — fawn Staffordshire Bull Terrier, solid coat.
- `dogs/staffordshire-bull-terrier--fawn--brindle.png` — fawn Staffordshire Bull Terrier, brindle coat.
- `dogs/staffordshire-bull-terrier--fawn--piebald.png` — fawn Staffordshire Bull Terrier, piebald coat.
- `dogs/staffordshire-bull-terrier--black--solid.png` — black Staffordshire Bull Terrier, solid coat.
- `dogs/staffordshire-bull-terrier--black--brindle.png` — black Staffordshire Bull Terrier, brindle coat.
- `dogs/staffordshire-bull-terrier--black--piebald.png` — black Staffordshire Bull Terrier, piebald coat.
- `dogs/staffordshire-bull-terrier--white--solid.png` — white Staffordshire Bull Terrier, solid coat.
- `dogs/staffordshire-bull-terrier--white--brindle.png` — white Staffordshire Bull Terrier, brindle coat.
- `dogs/staffordshire-bull-terrier--white--piebald.png` — white Staffordshire Bull Terrier, piebald coat.
- `dogs/american-bully--blue--solid.png` — blue American Bully, solid coat.
- `dogs/american-bully--blue--piebald.png` — blue American Bully, piebald coat.
- `dogs/american-bully--blue--brindle.png` — blue American Bully, brindle coat.
- `dogs/american-bully--black--solid.png` — black American Bully, solid coat.
- `dogs/american-bully--black--piebald.png` — black American Bully, piebald coat.
- `dogs/american-bully--black--brindle.png` — black American Bully, brindle coat.
- `dogs/american-bully--fawn--solid.png` — fawn American Bully, solid coat.
- `dogs/american-bully--fawn--piebald.png` — fawn American Bully, piebald coat.
- `dogs/american-bully--fawn--brindle.png` — fawn American Bully, brindle coat.
- `dogs/american-bully--chocolate--solid.png` — chocolate American Bully, solid coat.
- `dogs/american-bully--chocolate--piebald.png` — chocolate American Bully, piebald coat.
- `dogs/american-bully--chocolate--brindle.png` — chocolate American Bully, brindle coat.
- `dogs/american-bully--white--solid.png` — white American Bully, solid coat.
- `dogs/american-bully--white--piebald.png` — white American Bully, piebald coat.
- `dogs/american-bully--white--brindle.png` — white American Bully, brindle coat.
- `dogs/patterdale-terrier--black--solid.png` — black Patterdale Terrier, solid coat.
- `dogs/patterdale-terrier--black--piebald.png` — black Patterdale Terrier, piebald coat.
- `dogs/patterdale-terrier--chocolate--solid.png` — chocolate Patterdale Terrier, solid coat.
- `dogs/patterdale-terrier--chocolate--piebald.png` — chocolate Patterdale Terrier, piebald coat.
- `dogs/patterdale-terrier--red--solid.png` — red Patterdale Terrier, solid coat.
- `dogs/patterdale-terrier--red--piebald.png` — red Patterdale Terrier, piebald coat.
- `dogs/jagdterrier--black--saddle.png` — black Jagdterrier, saddle coat.
- `dogs/jagdterrier--black--solid.png` — black Jagdterrier, solid coat.
- `dogs/jagdterrier--chocolate--saddle.png` — chocolate Jagdterrier, saddle coat.
- `dogs/jagdterrier--chocolate--solid.png` — chocolate Jagdterrier, solid coat.
- `dogs/mountain-feist--white--piebald.png` — white Mountain Feist, piebald coat.
- `dogs/mountain-feist--white--tricolor.png` — white Mountain Feist, tricolor coat.
- `dogs/mountain-feist--white--solid.png` — white Mountain Feist, solid coat.
- `dogs/mountain-feist--black--piebald.png` — black Mountain Feist, piebald coat.
- `dogs/mountain-feist--black--tricolor.png` — black Mountain Feist, tricolor coat.
- `dogs/mountain-feist--black--solid.png` — black Mountain Feist, solid coat.
- `dogs/mountain-feist--red--piebald.png` — red Mountain Feist, piebald coat.
- `dogs/mountain-feist--red--tricolor.png` — red Mountain Feist, tricolor coat.
- `dogs/mountain-feist--red--solid.png` — red Mountain Feist, solid coat.
- `dogs/mountain-feist--tricolor--piebald.png` — tricolor Mountain Feist, piebald coat.
- `dogs/mountain-feist--tricolor--tricolor.png` — tricolor Mountain Feist, tricolor coat.
- `dogs/mountain-feist--tricolor--solid.png` — tricolor Mountain Feist, solid coat.
- `dogs/black-and-tan-coonhound--black--saddle.png` — black Black and Tan Coonhound, saddle coat.
- `dogs/black-and-tan-coonhound--black--solid.png` — black Black and Tan Coonhound, solid coat.
- `dogs/black-and-tan-coonhound--tan--saddle.png` — tan Black and Tan Coonhound, saddle coat.
- `dogs/black-and-tan-coonhound--tan--solid.png` — tan Black and Tan Coonhound, solid coat.
- `dogs/english-coonhound--red--ticked.png` — red English Coonhound, ticked coat.
- `dogs/english-coonhound--red--tricolor.png` — red English Coonhound, tricolor coat.
- `dogs/english-coonhound--red--piebald.png` — red English Coonhound, piebald coat.
- `dogs/english-coonhound--white--ticked.png` — white English Coonhound, ticked coat.
- `dogs/english-coonhound--white--tricolor.png` — white English Coonhound, tricolor coat.
- `dogs/english-coonhound--white--piebald.png` — white English Coonhound, piebald coat.
- `dogs/english-coonhound--tricolor--ticked.png` — tricolor English Coonhound, ticked coat.
- `dogs/english-coonhound--tricolor--tricolor.png` — tricolor English Coonhound, tricolor coat.
- `dogs/english-coonhound--tricolor--piebald.png` — tricolor English Coonhound, piebald coat.
- `dogs/majestic-tree-hound--black--saddle.png` — black Majestic Tree Hound, saddle coat.
- `dogs/majestic-tree-hound--black--tricolor.png` — black Majestic Tree Hound, tricolor coat.
- `dogs/majestic-tree-hound--black--solid.png` — black Majestic Tree Hound, solid coat.
- `dogs/majestic-tree-hound--tan--saddle.png` — tan Majestic Tree Hound, saddle coat.
- `dogs/majestic-tree-hound--tan--tricolor.png` — tan Majestic Tree Hound, tricolor coat.
- `dogs/majestic-tree-hound--tan--solid.png` — tan Majestic Tree Hound, solid coat.
- `dogs/majestic-tree-hound--red--saddle.png` — red Majestic Tree Hound, saddle coat.
- `dogs/majestic-tree-hound--red--tricolor.png` — red Majestic Tree Hound, tricolor coat.
- `dogs/majestic-tree-hound--red--solid.png` — red Majestic Tree Hound, solid coat.
- `dogs/presa-canario--fawn--brindle.png` — fawn Presa Canario, brindle coat.
- `dogs/presa-canario--fawn--solid.png` — fawn Presa Canario, solid coat.
- `dogs/presa-canario--black--brindle.png` — black Presa Canario, brindle coat.
- `dogs/presa-canario--black--solid.png` — black Presa Canario, solid coat.
- `dogs/presa-canario--buckskin--brindle.png` — buckskin Presa Canario, brindle coat.
- `dogs/presa-canario--buckskin--solid.png` — buckskin Presa Canario, solid coat.
- `dogs/boerboel--fawn--solid.png` — fawn Boerboel, solid coat.
- `dogs/boerboel--fawn--brindle.png` — fawn Boerboel, brindle coat.
- `dogs/boerboel--red--solid.png` — red Boerboel, solid coat.
- `dogs/boerboel--red--brindle.png` — red Boerboel, brindle coat.
- `dogs/boerboel--buckskin--solid.png` — buckskin Boerboel, solid coat.
- `dogs/boerboel--buckskin--brindle.png` — buckskin Boerboel, brindle coat.
- `dogs/boerboel--chocolate--solid.png` — chocolate Boerboel, solid coat.
- `dogs/boerboel--chocolate--brindle.png` — chocolate Boerboel, brindle coat.
- `dogs/dogue-de-bordeaux--red--solid.png` — red Dogue de Bordeaux, solid coat.
- `dogs/dogue-de-bordeaux--fawn--solid.png` — fawn Dogue de Bordeaux, solid coat.
- `dogs/rhodesian-ridgeback--red--solid.png` — red Rhodesian Ridgeback, solid coat.
- `dogs/rhodesian-ridgeback--fawn--solid.png` — fawn Rhodesian Ridgeback, solid coat.
- `dogs/rhodesian-ridgeback--buckskin--solid.png` — buckskin Rhodesian Ridgeback, solid coat.
- `dogs/carolina-dog--buckskin--solid.png` — buckskin Carolina Dog, solid coat.
- `dogs/carolina-dog--buckskin--saddle.png` — buckskin Carolina Dog, saddle coat.
- `dogs/carolina-dog--yellow--solid.png` — yellow Carolina Dog, solid coat.
- `dogs/carolina-dog--yellow--saddle.png` — yellow Carolina Dog, saddle coat.
- `dogs/carolina-dog--red--solid.png` — red Carolina Dog, solid coat.
- `dogs/carolina-dog--red--saddle.png` — red Carolina Dog, saddle coat.
- `dogs/german-shorthaired-pointer--chocolate--ticked.png` — chocolate German Shorthaired Pointer, ticked coat.
- `dogs/german-shorthaired-pointer--chocolate--piebald.png` — chocolate German Shorthaired Pointer, piebald coat.
- `dogs/german-shorthaired-pointer--white--ticked.png` — white German Shorthaired Pointer, ticked coat.
- `dogs/german-shorthaired-pointer--white--piebald.png` — white German Shorthaired Pointer, piebald coat.
- `dogs/beagle--tricolor--tricolor.png` — tricolor Beagle, tricolor coat.
- `dogs/beagle--tricolor--piebald.png` — tricolor Beagle, piebald coat.
- `dogs/beagle--tan--tricolor.png` — tan Beagle, tricolor coat.
- `dogs/beagle--tan--piebald.png` — tan Beagle, piebald coat.
- `dogs/beagle--white--tricolor.png` — white Beagle, tricolor coat.
- `dogs/beagle--white--piebald.png` — white Beagle, piebald coat.

---

## Tier 3 — the world

Everything that is not an animal. These are one-offs, so they can be richer than
the animal set — but keep the same flat-vector language.

### Items (31)

Replaces the SVG icons currently drawn in `js/icons.jsx`. Square, centred, transparent.

- `items/kibble.png` — **Bulk Kibble**. Keeps weight on. Nothing fancy.
- `items/highprotein.png` — **High-Protein Feed**. Working-dog ration. Builds wind.
- `items/rawdiet.png` — **Raw Diet**. Meat, bone, organ. Hard-conditioned dogs thrive on it.
- `items/perfblend.png` — **Performance Blend**. Competition ration. What the trial kennels feed.
- `items/electrolytes.png` — **Electrolyte Mix**. Pours back what a long hunt took out.
- `items/woundsalve.png` — **Wound Salve**. Cuts and scrapes. Field-standard.
- `items/antibiotics.png` — **Antibiotics**. For a hog cut gone hot. Clears infection.
- `items/jointsupp.png` — **Joint Supplement**. Keeps an older dog sound and moving square.
- `items/vetkit.png` — **Full Vet Workup**. Sutures, fluids, rest. Brings a dog all the way back.
- `items/scentdrag.png` — **Scent Drag**. Lay a line and let them work it out.
- `items/flirtpole.png` — **Flirt Pole**. Builds drive and foot speed.
- `items/springpole.png` — **Spring Pole**. Hangs from the oak. Builds a jaw.
- `items/weightvest.png` — **Weight Vest**. Walk them heavy. Adds power everywhere.
- `items/showlead.png` — **Show Lead & Table**. Stacking practice for the bench.
- `items/baypen.png` — **Bay Pen Session**. Controlled bay work. Reads a dog's nerve.
- `items/treadmill.png` — **Slat Mill**. The old standby. Nothing builds wind like it.
- `items/ropetug.png` — **Braided Tug Rope**. Two ends and a fight in the middle.
- `items/knottedball.png` — **Knotted Rope Ball**. Heavy enough to carry all afternoon.
- `items/puzzlebox.png` — **Feed Puzzle Box**. Kibble comes out once the trick is worked out.
- `items/scentdummy.png` — **Canvas Scent Dummy**. Something to find, which is easier than something to face.
- `items/softfleece.png` — **Fleece Snuggle Toy**. Not for chewing. For keeping.
- `items/rubberbone.png` — **Hard Rubber Bone**. Outlasts most arguments.
- `items/vaccine.png` — **Annual Vaccination**. Papers the trial secretary will actually accept.
- `items/collarbrass.png` — **Brass-Buckle Collar**. Heavy leather, brass hardware.
- `items/collarred.png` — **Red Working Collar**. Easy to spot in thick cover.
- `items/collarorange.png` — **Blaze Orange Collar**. Safety orange. Hunt season legal.
- `items/collarblack.png` — **Black Latigo Collar**. Plain, dark, and tough.
- `items/collarteal.png` — **Turquoise Collar**. Show ring flash.
- `items/collarcamo.png` — **Camo Collar**. Timber pattern.
- `items/bandanared.png` — **Red Bandana**. Tied at the throat. Classic.
- `items/collarsilver.png` — **Silver Trial Collar**. Awarded look, bought price.

### Kennel upgrades (5)

Small building illustrations for the store cards.

- `upgrades/feedsilo.png` — **Feed Silo**. Buy feed in bulk. Cuts daily upkeep by a quarter.
- `upgrades/vetshed.png` — **Vet Shed**. On-site care. Dogs recover noticeably faster every day.
- `upgrades/whelpingbox.png` — **Whelping Barn**. Proper whelping quarters. Far fewer pups lost from a litter.
- `upgrades/trainingyard.png` — **Training Yard**. Dedicated conditioning ground. Training gear gives more and costs less.
- `upgrades/scentkennel.png` — **Scent Kennel**. Purpose-built hound runs. Hunts pay better and injure less.

### Hunts (4)

Scene tiles for the hunt picker — quarry and country, no dogs in frame.

- `hunts/hog.png` — **Hog Hunt**. Bay and catch. Rewards grit and grip.
- `hunts/coon.png` — **Coon Hunt**. Trail and tree. Rewards nose and wind.
- `hunts/trail.png` — **Blood Trailing**. Track wounded game. Rewards nose and nerve.
- `hunts/squirrel.png` — **Squirrel Hunt**. Light work for young dogs.

### Trials and shows

Event tiles.

- `trials/weightpull.png` — **Weight Pull**. Drag a loaded sled the farthest. Rewards grit and grip.
- `trials/catchcourse.png` — **Catch-Dog Course**. Work a padded decoy against the clock. Rewards gameness and speed.
- `trials/treeingtrial.png` — **Treeing Trial**. Find and tree the fastest. Rewards nose and stamina.
- `trials/show.png` — **Conformation Show**. A bench show — judged on structure and breed type, not work ethic.
- `shows/barrelracing.png` — **Barrel Racing**. Cloverleaf pattern against the clock. Rewards speed and agility.
- `shows/reining.png` — **Reining**. Spins, sliding stops, precise patterns. Rewards agility and temperament.
- `shows/racing.png` — **Flat Racing**. Straight-up speed over a quarter mile. Rewards speed and stamina.
- `shows/halter.png` — **Halter / Conformation**. Judged standing, structure and breed type only.
- `shows/jumping.png` — **Show Jumping**. Clear a course of fences. Rewards agility and conformation.
- `shows/pulling.png` — **Pulling Competition**. Draft strength event — drag a weighted sled.

### Property (37)

Land, houses and where the place sits.

- `land/0.png` — **Rented Lot**
- `land/1.png` — **Quarter Acre Lot**
- `land/2.png` — **Half Acre Lot**
- `land/3.png` — **One Acre Lot**
- `land/4.png` — **Two Acre Lot**
- `land/5.png` — **Five Acre Homestead**
- `land/6.png` — **Ten Acre Homestead**
- `land/7.png` — **Twenty Acre Spread**
- `land/8.png` — **Forty Acre Spread**
- `land/9.png` — **Eighty Acre Ranch**
- `land/10.png` — **160 Acre Ranch**
- `land/11.png` — **Full Section Ranch**
- `houses/0.png` — **Bare Land, No House**
- `houses/1.png` — **Single-Wide**
- `houses/2.png` — **Double-Wide**
- `houses/3.png` — **Starter Farmhouse**
- `houses/4.png` — **Farmhouse**
- `houses/5.png` — **Ranch House**
- `houses/6.png` — **Ranch House w/ Kennel Wing**
- `houses/7.png` — **Custom Kennel Compound**
- `houses/8.png` — **Show Kennel Estate**
- `locations/0.png` — **0**
- `locations/1.png` — **1**
- `locations/2.png` — **2**
- `locations/3.png` — **3**
- `locations/4.png` — **4**
- `locations/5.png` — **5**
- `locations/6.png` — **6**
- `locations/7.png` — **7**
- `locations/8.png` — **8**
- `locations/9.png` — **9**
- `locations/10.png` — **10**
- `locations/11.png` — **11**
- `locations/12.png` — **12**
- `locations/13.png` — **13**
- `locations/14.png` — **14**
- `locations/15.png` — **15**

### Trucks and trailers (19)

Three-quarter view, working vehicles with some age on them.

- `trucks/0.png` — **No Truck**
- `trucks/1.png` — **Ford F-250 Super Duty**
- `trucks/2.png` — **Ford F-350 Dually**
- `trucks/3.png` — **Chevrolet Silverado 2500HD**
- `trucks/4.png` — **Chevrolet Silverado 3500HD**
- `trucks/5.png` — **RAM 2500**
- `trucks/6.png` — **RAM 3500 Dually**
- `trucks/7.png` — **GMC Sierra 3500HD Denali**
- `trucks/8.png` — **Kenworth T370**
- `trucks/9.png` — **Peterbilt 337**
- `trucks/10.png` — **Freightliner M2 106**
- `trucks/11.png` — **International MV Series**
- `trailers/0.png` — **No Trailer**
- `trailers/1.png` — **2-Horse Bumper Pull Trailer**
- `trailers/2.png` — **3-Head Stock Trailer**
- `trailers/3.png` — **4-Horse Gooseneck Trailer**
- `trailers/4.png` — **6-Head Stock Trailer**
- `trailers/5.png` — **10-Head Gooseneck Stock Trailer**
- `trailers/6.png` — **53' Semi Livestock Pot Trailer**

### Clinics (4)

Small building portraits — each should look like its price.

- `clinics/county.png` — **County Animal Clinic**. Two vets and a waiting room full of farm dogs. Cheap, brisk, fine.
- `clinics/riverbend.png` — **Riverbend Veterinary**. Small-animal practice in town. Slower, gentler, and they keep proper records.
- `clinics/haggerty.png` — **Haggerty Large Animal**. Mostly cattle work. They will do a dog, and they do it properly.
- `clinics/mobile.png` — **Mobile Round**. The truck comes to you on its circuit. Costs more, saves the haul.

### Registries (5)

Crest or seal, not a building. Stamped-looking, single colour plus gold.

- `registries/terrier.png` — **Southern Bull & Terrier Registry**. Keeps the bull-and-terrier lines honest, and has done since before anyone here was born.
- `registries/cur.png` — **Cur & Feist Breeders Association**. Working stock only. They will ask what the dog has actually done.
- `registries/hound.png` — **National Treeing Hound Registry**. Nose, voice and tree sense, recorded properly for once.
- `registries/bulldog.png` — **Working Bulldog Stud Book**. Catch weight, structure and temperament, all on the record.
- `registries/gundog.png` — **Field & Gundog Register**. Birds and blood trails. Smaller book, longer memory.

### Seasons (4)

Small banner strips for the rail's Game Time box.

- `seasons/0.png` — **Spring**
- `seasons/1.png` — **Summer**
- `seasons/2.png` — **Fall**
- `seasons/3.png` — **Winter**

### Personalities (6)

Small round badges for the animal profile.

- `personality/bold.png` — **Bold**. First out of the box and last to quit.
- `personality/steady.png` — **Steady**. Hard to rattle, harder to hurry.
- `personality/busy.png` — **Busy**. Needs a job or invents one.
- `personality/wary.png` — **Wary**. Watches a while before committing.
- `personality/sweet.png` — **Sweet**. Would rather be beside you than anywhere.
- `personality/stubborn.png` — **Stubborn**. Has opinions, and keeps them.

### One-offs (3)

- `world/atlas-map.png` — the illustrated county map for the Atlas page. Hand-drawn
  survey feel, labelled buildings for the kennel, market, clinics, adoption centre,
  trial grounds and the hunting country. Needs clickable regions, so keep the
  buildings well separated.
- `world/title-hero.png` — wide banner for the title screen, behind the logo.
- `world/empty-pen.png` — the placeholder shown where an animal has no picture yet.

---

## Totals

| Set | Images |
| --- | ---: |
| Tier 1 breed heroes | 59 |
| Tier 2a coat patterns (recommended) | 66 |
| Tier 2b every appearance (alternative) | 211 |
| Tier 3 world art | 128 |
| **Recommended path (1 + 2a + 3)** | **253** |

## Where to put them

Drop them in `assets/` following the paths above — `assets/dogs/plott-hound.png`
and so on. The code already prefers a real file over a drawing wherever one exists
(`ItemIcon` in `js/icons.jsx` does this today), and the same pattern extends to
animals. Send them over and I will wire them up.
