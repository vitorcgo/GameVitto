/** Official promotional portraits. Provenance and individual URLs are retained
 * in item-art/SOURCES.md; all images are served locally, without a CDN at play. */
export function itemPortraits(){
 return Object.fromEntries(['mushroom','green','red','banana','blue','star'].map(type=>[type,`<img src="./item-art/${type}.png" alt="${type}"/>`]));
}
