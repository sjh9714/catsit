# Photo-cat assets — sources & licenses

All photos are from Pexels, under the [Pexels license](https://www.pexels.com/license/)
(free to use and modify, attribution appreciated). Cutouts were made with
`scripts/cutout.swift` (macOS Vision background removal) and trimmed to content bounds.

| File | Pose | Source | Photographer |
| --- | --- | --- | --- |
| `f30671016.jpg` → `trim30671016.png` | sitting (idle) | [pexels.com/photo/30671016](https://www.pexels.com/photo/adorable-white-kitten-with-bright-blue-eyes-30671016/) | [TARIK BAYRAM](https://www.pexels.com/@tarik-bayram-64075006/) |
| `f30671018.jpg` → `trim30671018.png` | standing, tail up (alert / walk) | [pexels.com/photo/30671018](https://www.pexels.com/photo/30671018/) | [TARIK BAYRAM](https://www.pexels.com/@tarik-bayram-64075006/) |
| `f24879273.jpg` → `sleepflat.png` | dozing, paws over an edge (sleep) | [pexels.com/photo/24879273](https://www.pexels.com/photo/adorable-fluffy-white-cat-24879273/) | [@daminator](https://www.pexels.com/@daminator/) |

`sleepflat.png` has its bottom edge cropped flat on purpose: in the terminal the cat
sleeps with its paws draped over the top border of the prompt box, so the flat edge
sits on that line.

`preview.png` is the three poses composited on a dark background for review.

The `trim*.png` / `sleepflat.png` cutouts are regenerable from the source JPGs:
`swiftc scripts/cutout.swift -o cutout && ./cutout in.jpg out.png`, then crop to the
alpha bounding box.
