// All player-facing text in one place. Edit freely.

export const S = {
  title: "Faded Passport",
  bureau: "Bureau of Returns",
  form: "Form 40-Y · Application to return home",

  titlePage: {
    tagline: "A border crossing, in reverse.",
    begin: "Begin",
    credit: "A quantum story made with Moth Quantum's Teleblur engine",
  },

  /** Shown one paragraph at a time. */
  story: {
    paragraphs: [
      "You left a long time ago. You meant to come back sooner.",
      "Since then, the streets have been renamed. The bakery is a phone shop. Your mother's number rings somewhere else.",
      "You still carry the passport. The photo in it is of someone who no longer exists.",
      "Now you are standing at the border, in a queue that has not moved in years.",
    ],
    next: "Go on",
    enter: "Step up to the desk",
  },

  intro: {
    lead: "The officer doesn't look up.",
    question: "How long since you last came home?",
    /** In-world readout of the Teleblur values for the chosen years (the permit prints the technical names). */
    readout: (strength: string, size: number) => `Degradation index ${strength} · Record grain ${size}`,
    years: (n: number) => (n === 1 ? "1 year" : `${n} years`),
    privacy: "Photos are sent to Moth Quantum's API for processing and deleted afterwards. This app stores nothing.",
    start: "Join the queue",
  },

  portrait: {
    officer: "Passport, please.",
    hint: "A portrait. Your face, looking straight ahead.",
    take: "Take a selfie",
    choose: "Choose a photo",
    next: "Hand it over",
    retake: "Another photo",
  },

  mask: {
    officer: "Who are you? Show me.",
    hint: "Draw around your face with your finger. Lift to close the line.",
    undo: "Undo",
    clear: "Start over",
    zoom: "Zoom",
    move: "Move",
    draw: "Draw",
    tooSmall: "Draw a bit bigger: around the whole face.",
    next: "This is me",
  },

  home: {
    officer: "Where are you going?",
    hint: "A photo of home, or of where you are standing now.",
    take: "Take a photo",
    choose: "Choose a photo",
    next: "Home",
    retake: "Another photo",
  },

  processing: {
    officer: [
      "Wait here.",
      "The officer holds your photo up to the light.",
      "They look at the photo. They look at you. They look at the photo.",
      "Somewhere, a qubit is deciding who you are.",
    ],
    slow: "This is taking longer than usual. Please remain in the queue.",
  },

  verdict: {
    officer: "Entry denied.",
    /** Picked by how much Teleblur changed the face (see VERDICT_THRESHOLDS in config.ts). */
    reasons: {
      low: "This photo does not match the bearer.",
      medium: "This address cannot be verified.",
      high: "The person in this photo is a place.",
    },
    handBack: "Take your documents",
  },

  document: {
    heading: "Entry permit",
    bearer: "Bearer",
    destination: "Declared destination",
    yearsAbsent: "Years absent",
    date: "Date of application",
    decision: "Decision",
    reason: "Reason",
    stamp: "Entry denied",
    download: "Download document",
    again: "Try to return again",
    processedBy: "Processed on the Moth Quantum Atlas API",
  },

  errors: {
    closed: "The border is closed today. Come back later.",
    busy: "The queue is too long right now. Try again in a minute.",
    invalid: "Your papers are not in order. Please start again.",
    timeout: "The officer has gone on a break. Please try again.",
    unreadable: "This photo can't be read here. Try a JPEG or PNG, or take the photo again.",
    generic: "Something went wrong at the border. Please try again.",
    retry: "Back to the queue",
  },
} as const;
