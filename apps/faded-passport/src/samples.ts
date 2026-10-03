// Sample images for testing and demo recordings: swap them by replacing the files in
// public/samples/ (or editing these paths). Shown only with ?debug ("Use sample photo");
// players never see them. Files in public/samples/ are gitignored and left out of exports.
export const SAMPLES = {
  portrait: ["/samples/portrait.png"],
  /** Each press of "Use sample photo" on the home step moves to the next one. */
  home: ["/samples/home-street.png", "/samples/home-canal.png", "/samples/home-park.png"],
} as const;
