const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
const shell = (color, wings = false) =>
  svg(
    `${wings ? '<path d="M28 40Q-5 0 4 51L28 68M72 40Q105 0 96 51L72 68" fill="#edf8ff" stroke="#768bb8" stroke-width="3"/>' : ""}<ellipse cx="50" cy="75" rx="39" ry="15" fill="#fff3ce" stroke="#283754" stroke-width="3"/><path d="M15 68C13 4 86 4 85 68Q50 86 15 68" fill="${color}" stroke="#273448" stroke-width="4"/><path d="M31 24L49 40 68 23M49 40L45 65M15 52L45 65 84 49" fill="none" stroke="#ffffff77" stroke-width="4"/>`,
  );
export const ITEM_ICONS = {
  banana: svg(
    '<path d="M49 12L59 12 57 45Q70 63 92 66L82 85Q57 81 51 62 38 89 13 82L6 67Q34 63 45 45Z" fill="#ffe12e" stroke="#a67716" stroke-width="4"/><path d="M45 42L56 42" stroke="#5c7632" stroke-width="6"/><ellipse cx="46" cy="51" rx="2" ry="4"/><ellipse cx="55" cy="51" rx="2" ry="4"/>',
  ),
  green: shell("#45bf59"),
  red: shell("#ec4651"),
  blue: shell("#4289ff", true),
  mushroom: svg(
    '<path d="M28 63L72 63 70 85Q50 99 30 85Z" fill="#ffe6b0" stroke="#a98452" stroke-width="3"/><path d="M7 61C5-7 94-7 93 61Q51 80 7 61" fill="#ed3b46" stroke="#6f203b" stroke-width="4"/><ellipse cx="50" cy="26" rx="18" ry="20" fill="white"/><ellipse cx="16" cy="46" rx="8" ry="17" fill="white"/><ellipse cx="84" cy="46" rx="8" ry="17" fill="white"/><path d="M42 77V85M58 77V85" stroke="#182236" stroke-width="4"/>',
  ),
  star: svg(
    '<path d="M50 4L63 34 97 36 71 59 79 94 50 76 21 94 29 59 3 36 37 34Z" fill="#ffe53c" stroke="#bd8312" stroke-width="4"/><path d="M42 44V58M58 44V58" stroke="#172236" stroke-width="5" stroke-linecap="round"/>',
  ),
  empty: svg(
    '<text x="50" y="72" fill="#7183a9" font-family="Arial" font-weight="bold" font-size="75" text-anchor="middle">?</text>',
  ),
};
// Optional native menu sprites. Cropping happens in the renderer, preserving
// the source sheet untouched. Coordinates exclude its one-pixel grid lines.
const sourcePortraits = new Map();
export async function loadSourcePortraits() {
  const image = new Image();
  const loaded = await new Promise(resolve => { image.onload=()=>resolve(true); image.onerror=()=>resolve(false); image.src='/assets/mario-kart/ui/driver-icons.png'; });
  if (!loaded) return false;
  for (const [id,col,row] of [['mario',0,0],['luigi',1,0],['peach',2,0],['yoshi',6,0],['toad',6,1],['koopa',7,1],['bowser',7,3],['donkey-kong',8,3]]) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    canvas.getContext('2d').drawImage(image,1+col*129,1+row*129,128,128,0,0,128,128);
    sourcePortraits.set(id,canvas.toDataURL());
  }
  return true;
}
export function portrait(c) {
  if (sourcePortraits.has(c.id)) return sourcePortraits.get(c.id);
  const animal = ["yoshi", "bowser", "donkey-kong", "koopa"].includes(c.id),
    skin = animal ? c.color : "#ffcc9f";
  let extra = "";
  if (c.id === "mario" || c.id === "luigi")
    extra = `<path d="M14 39Q12 7 50 7T86 39Z" fill="${c.color}"/><ellipse cx="50" cy="39" rx="42" ry="8" fill="${c.color}"/><circle cx="50" cy="23" r="12" fill="white"/><text x="50" y="31" text-anchor="middle" font-family="Arial" font-size="22" font-weight="900" fill="${c.color}">${c.id === "mario" ? "M" : "L"}</text><path d="M27 67Q40 56 50 66Q60 56 73 67Q61 80 50 73Q39 80 27 67" fill="#532a21"/>`;
  if (c.id === "toad")
    extra =
      '<ellipse cx="50" cy="29" rx="46" ry="29" fill="#fff7e9"/><ellipse cx="50" cy="22" rx="18" ry="22" fill="#e52a44"/><ellipse cx="8" cy="30" rx="9" ry="16" fill="#e52a44"/><ellipse cx="92" cy="30" rx="9" ry="16" fill="#e52a44"/>';
  if (c.id === "peach")
    extra =
      '<path d="M14 52Q5 3 50 12Q94 3 85 57L72 29 54 43 28 31Z" fill="#f6ca37"/><path d="M33 20L28 1 43 9 51 0 59 9 73 1 67 20Z" fill="#ffc826" stroke="#fcf1a5" stroke-width="2"/>';
  if (c.id === "yoshi" || c.id === "koopa")
    extra = `<ellipse cx="50" cy="70" rx="32" ry="23" fill="${skin}"/><ellipse cx="35" cy="30" rx="14" ry="22" fill="white"/><ellipse cx="65" cy="30" rx="14" ry="22" fill="white"/><ellipse cx="37" cy="33" rx="5" ry="12" fill="#183c2d"/><ellipse cx="63" cy="33" rx="5" ry="12" fill="#183c2d"/>`;
  if (c.id === "bowser")
    extra =
      '<path d="M16 44L5 6 28 28M84 44L95 6 72 28" fill="#fff0c6"/><path d="M25 21L31 0 48 17 58 0 73 23" fill="#dd4434"/><ellipse cx="50" cy="70" rx="33" ry="19" fill="#ffe09d"/>';
  if (c.id === "donkey-kong")
    extra =
      '<ellipse cx="50" cy="65" rx="34" ry="25" fill="#d8aa73"/><path d="M17 35Q50 13 83 35L79 48 20 48" fill="#743d25"/>';
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      svg(
        `<rect width="100" height="100" rx="16" fill="${c.color}33"/><ellipse cx="50" cy="99" rx="43" ry="25" fill="${c.color}"/><ellipse cx="50" cy="54" rx="34" ry="39" fill="${skin}"/><ellipse cx="36" cy="52" rx="6" ry="11" fill="white"/><ellipse cx="64" cy="52" rx="6" ry="11" fill="white"/><ellipse cx="36" cy="54" rx="3" ry="7" fill="#15365a"/><ellipse cx="64" cy="54" rx="3" ry="7" fill="#15365a"/>${extra}`,
      ),
    )
  );
}
