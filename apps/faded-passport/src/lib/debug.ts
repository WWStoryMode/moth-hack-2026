/** Add ?debug to the URL for developer tools (mask preview, input download). Never on by default. */
export const DEBUG = typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");
