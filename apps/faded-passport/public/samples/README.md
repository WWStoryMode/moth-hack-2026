# Sample photos (debug only)

Every player can use these instead of their own photos: **Use a sample portrait** and **Use a sample place**
(shown before a photo is chosen), and **Another place** on a sample home photo to cycle the homes:

- `portrait.png`: a passport-style portrait
- `home-street.png`, `home-canal.png`, `home-park.png`: places to call "home"

Any size or orientation works: the app crops and re-encodes them exactly like a player's upload.
Paths are set in `src/samples.ts`.

The four pixel-art samples above are **committed and public** (they're served at `/samples/…` on the
deployed site). Anything else you drop in this folder is **gitignored** and left out of `pnpm export`,
so personal photos never reach GitHub. To publish another image, add its name to `.gitignore` here.
