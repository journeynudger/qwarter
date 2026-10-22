// The reference design's script registers a service worker at this address. This site has nothing to cache
// offline, so the worker does nothing and never takes control of a page.
self.addEventListener("install", () => self.skipWaiting());
