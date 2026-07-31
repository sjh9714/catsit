# Living-cat frames — how they were made

The five beats in this directory are one continuous performance of an
AI-generated white kitten, produced with Kling (video model 3.0) on a chroma
green stage and cut into frames:

- `walkIn/` — walks in from the right and turns to face you (10fps, one-shot)
- `sitDown/` — settles into a sit (10fps, one-shot)
- `idle/` — sits and breathes; first and last frames are identical, so it
  loops seamlessly (8fps, loop)
- `alertUp/` — startles, rears up on its hind legs in a silent meow, lands
  back on all fours (10fps, one-shot)
- `walkOut/` — turns away and walks off (10fps, one-shot)
- `sleepDown/` — gets drowsy and curls up into a ball (10fps, one-shot)
- `sleepLoop/` — sleeps; breathing only, first and last frames identical
  (8fps, loop)
- `wakeUp/` — stirs, yawns, stretches, and sits back up (10fps, one-shot)

Every beat was generated with its start frame pinned to the previous beat's
last frame (Kling start/end frame conditioning), so beat boundaries are
pixel-identical and the whole cycle plays as a single connected take.

`half.bin` is the same performance baked to a 36×26 RGBA grid per frame
(scripts/gen-half.mjs) for terminals without graphics support — they render
it as ▀ half-blocks.

Pipeline (regenerable): chroma key + despill (ffmpeg) → one shared crop
window across all beats → 256px-tall canvas → PNG8 palette per beat
(`scripts/`... see the repo's video scripts). `manifest.json` records each
beat's capture fps, loop flag, and the cat's horizontal center used to anchor
the speech bubble.
