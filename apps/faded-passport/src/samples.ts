// Sample images any player can use instead of their own photos ("Use a sample portrait" /
// "Use a sample place"): swap them by replacing the files in public/samples/ (or editing these
// paths). These four pixel-art images are committed; anything else in that folder is gitignored.
export const SAMPLES = {
  portrait: ["/samples/portrait.png"],
  /** Each press of the sample button on the home step moves to the next one. */
  home: ["/samples/home-street.png", "/samples/home-canal.png", "/samples/home-park.png"],
} as const;
