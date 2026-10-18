// The loader says it's done once, with a 'loaderdone' event. A script that
// runs after that would wait forever (it depends on script order on the page),
// so the moment is also left on <html> as data-loaded.
export const loaded = () => document.documentElement.hasAttribute('data-loaded');

/** runs fn when the loader is done — now, if it already is */
export function afterLoader(fn: () => void) {
  if (loaded()) fn();
  else addEventListener('loaderdone', fn, { once: true });
}
