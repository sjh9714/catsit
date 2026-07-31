# Living-cat frames — sources & licenses

The PNG frames in this directory are cut from free stock videos on Pexels,
under the [Pexels license](https://www.pexels.com/license/) (free to use and
modify, attribution appreciated):

- `idle/` (60 frames, sitting loop) — **"Fluffy White Cat Sitting by a Fence
  Outdoors"** —
  [pexels.com/video/34753028](https://www.pexels.com/video/fluffy-white-cat-sitting-by-a-fence-outdoors-34753028/)
  by [Havvanur](https://www.pexels.com/@havvanur-2156235692/)
- `walkL/` + `walkR/` (20-frame gait cycle, mirrored pair) — **"A white cat
  standing on the ground looking out a window"** —
  [pexels.com/video/16285100](https://www.pexels.com/video/a-white-cat-standing-on-the-ground-looking-out-a-window-16285100/)
  by [Afeef kp](https://www.pexels.com/@afeef-kp-359546557/)

Pipeline (regenerable): 10–12fps frame extraction (ffmpeg) → per-frame
background removal with `scripts/cutout.swift` (macOS Vision) → temporal alpha
median + crop + scale via `scripts/video-post.mjs` (idle: union-bbox) and
`scripts/video-post-walk.mjs` (walk: per-frame feet/center stabilization onto a
fixed canvas + gait-cycle selection + hflip for the opposite direction). Idle
playback ping-pongs; walk loops forward. All canvases are 256px tall with the
cat's feet on the bottom edge, so every set shares one baseline.
