# Sample photos (debug only)

Put sample images here to use the **Use sample photo** button, which appears only with `?debug`:

- `portrait.png`: a passport-style portrait
- `home-street.png`, `home-canal.png`, `home-park.png`: places to call "home" (the button cycles through them)

Any size or orientation works: the app crops and re-encodes them exactly like a player's upload.
Paths are set in `src/samples.ts`.

The four pixel-art samples above are **committed and public** (they're served at `/samples/…` on the
deployed site). Anything else you drop in this folder is **gitignored** and left out of `pnpm export`,
so personal photos never reach GitHub. To publish another image, add its name to `.gitignore` here.
