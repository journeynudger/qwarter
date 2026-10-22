"use client";

import { useEffect } from "react";

/*
 * Says when React has hydrated the study page. study.js (a deferred classic script) runs before React's chunks
 * arrive, and it rewrites the page's text (the statement into words, the figures counting from 0, the "+" sheets
 * lifted into the dialog); hydration arriving after that finds text that no longer matches and renders the page
 * again over the script's work. So study.js waits for this effect, which runs once the page is hydrated.
 */
export function Hydrated() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
    document.dispatchEvent(new Event("qw:hydrated"));
  }, []);
  return null;
}
