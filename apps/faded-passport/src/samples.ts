// Sample images for testing and demo recordings: swap them by replacing the files in
// public/samples/ (or editing these paths). The button is shown only with ?debug ("Use sample
// photo"). These four pixel-art images are committed; anything else in that folder is gitignored.
export const SAMPLES = {
  portrait: ["/samples/portrait.png"],
  /** Each press of "Use sample photo" on the home step moves to the next one. */
  home: ["/samples/home-street.png", "/samples/home-canal.png", "/samples/home-park.png"],
} as const;
