/** Locally drawn sign artwork, based on the visual identities visible in race
 * footage. No source-image pixels or extracted game textures are used. */
export const STADIUM_BRANDS = [
  "MOTORES MARIO",
  "ÓLEO BOWSER",
  "BATERIA FUZZY",
  "MKTV",
  "Lemmy’s",
  "RODA DOURADA",
  "BILL BALA",
  "COPA COGUMELO",
];
const cache = new Map();
export function stadiumBrand(name, canvasTexture) {
  if (cache.has(name)) return cache.get(name);
  const texture = canvasTexture(1024, 256, (c, w, h) => {
    const fill = (color) => {
      c.fillStyle = color;
      c.fillRect(0, 0, w, h);
    };
    const text = (
      label,
      x,
      y,
      size,
      color,
      stroke = null,
      font = "Arial Black,Arial",
      max = 920,
    ) => {
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `italic 900 ${size}px ${font}`;
      c.lineJoin = "round";
      if (stroke) {
        c.lineWidth = 9;
        c.strokeStyle = stroke;
        c.strokeText(label, x, y, max);
      }
      c.fillStyle = color;
      c.fillText(label, x, y, max);
    };
    const circle = (x, y, r, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    };
    const checker = (y, color, size = 20) => {
      c.fillStyle = color;
      for (let x = 0; x < w; x += size)
        for (let row = 0; row < 2; row++)
          if ((x / size + row) % 2 === 0)
            c.fillRect(x, y + row * size, size, size);
    };
    if (name === "ÓLEO BOWSER") {
      fill("#f5df57");
      checker(216, "#252519", 18);
      text("BOWSER", 303, 124, 130, "#202319", null, undefined, 510);
      // Spiked turtle-shell badge: an original silhouette, not a traced logo.
      circle(690, 124, 91, "#202319");
      circle(690, 124, 68, "#f5df57");
      c.fillStyle = "#202319";
      c.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10,
          r = i % 2 ? 45 : 65;
        c.lineTo(690 + Math.cos(a) * r, 124 + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      for (const x of [675, 705]) {
        circle(x, 114, 10, "#f5df57");
      }
      text("OIL", 895, 128, 137, "#202319", null, undefined, 200);
    } else if (name === "BATERIA FUZZY") {
      fill("#ac202b");
      c.fillStyle = "#1f2327";
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(500, 0);
      c.lineTo(365, 256);
      c.lineTo(0, 256);
      c.fill();
      // Jagged soot sprite and contrasting battery wordmark.
      c.fillStyle = "#f2efdc";
      c.beginPath();
      for (let i = 0; i < 36; i++) {
        const a = (i * Math.PI) / 18,
          r = i % 2 ? 77 : 96;
        c.lineTo(155 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      circle(155, 128, 64, "#25272a");
      circle(135, 116, 18, "#fff");
      circle(175, 116, 18, "#fff");
      circle(140, 119, 8, "#161619");
      circle(172, 119, 8, "#161619");
      text("FUZZY", 390, 77, 93, "#fff2d1", "#181a22", undefined, 380);
      text("Battery", 680, 161, 121, "#f2e4cc", "#27252b", "Georgia", 610);
      c.fillStyle = "#f5d858";
      c.fillRect(280, 223, 710, 8);
    } else if (name === "MKTV") {
      fill("#f4f2df");
      circle(168, 146, 72, "#47a6d5");
      c.strokeStyle = "#b8e2e7";
      c.lineWidth = 5;
      for (const x of [139, 168, 197]) {
        c.beginPath();
        c.ellipse(168, 146, Math.abs(x - 168) + 12, 68, 0, 0, Math.PI * 2);
        c.stroke();
      }
      for (const y of [117, 146, 175]) {
        c.beginPath();
        c.ellipse(168, y, 67, 10, 0, 0, Math.PI * 2);
        c.stroke();
      }
      text("MKTV", 599, 118, 146, "#283746", null, undefined, 625);
      text(
        "TELEVISÃO MARIO KART",
        600,
        216,
        30,
        "#526775",
        null,
        "Arial",
        650,
      );
      c.strokeStyle = "#438bb4";
      c.lineWidth = 12;
      for (const r of [30, 53, 76]) {
        c.beginPath();
        c.arc(862, 116, r, -0.85, 0.85);
        c.stroke();
      }
    } else if (name === "RODA DOURADA") {
      fill("#172224");
      circle(109, 127, 83, "#e8ca6a");
      circle(109, 127, 65, "#172224");
      circle(109, 127, 15, "#e8ca6a");
      c.strokeStyle = "#e8ca6a";
      c.lineWidth = 9;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.beginPath();
        c.moveTo(109, 127);
        c.lineTo(109 + Math.cos(a) * 67, 127 + Math.sin(a) * 67);
        c.stroke();
      }
      text("RODA DOURADA", 610, 130, 90, "#e8ca6a", null, "Arial", 755);
      c.fillStyle = "#e8ca6a";
      c.fillRect(20, 15, 984, 4);
      c.fillRect(20, 237, 984, 4);
    } else if (name === "Lemmy’s") {
      fill("#f5f0df");
      text("Lemmy’s", 515, 127, 169, "#283032", "#ffffff", "Georgia", 900);
      // Thin green baseline and wheels make this read as a different sponsor.
      c.fillStyle = "#688949";
      c.fillRect(35, 226, 954, 8);
      circle(137, 213, 17, "#303b30");
      circle(896, 213, 17, "#303b30");
    } else if (name === "BILL BALA") {
      fill("#e0b949");
      c.fillStyle = "#212d39";
      c.fillRect(0, 49, w, 152);
      c.fillStyle = "#faf2d2";
      c.beginPath();
      c.roundRect(50, 83, 163, 90, 45);
      c.fill();
      circle(172, 111, 12, "#212d39");
      c.fillStyle = "#faf2d2";
      for (let i = 0; i < 3; i++) c.fillRect(13, 93 + i * 27, 39, 8);
      text("BILL BALA", 623, 116, 115, "#f6e8b8", null, undefined, 730);
      text("PROVA DE VELOCIDADE", 675, 184, 30, "#f6e8b8", null, "Arial", 700);
    } else if (name === "COPA COGUMELO") {
      fill("#26326d");
      circle(132, 110, 75, "#ecd178");
      circle(132, 110, 61, "#c83540");
      c.fillStyle = "#fff0ce";
      c.beginPath();
      c.ellipse(132, 98, 47, 32, 0, Math.PI, Math.PI * 2);
      c.lineTo(177, 109);
      c.lineTo(87, 109);
      c.closePath();
      c.fill();
      c.fillRect(113, 108, 38, 34);
      circle(132, 85, 15, "#ce3541");
      circle(120, 122, 4, "#26326d");
      circle(144, 122, 4, "#26326d");
      c.fillStyle = "#ecd178";
      c.fillRect(122, 180, 20, 28);
      c.fillRect(86, 207, 92, 15);
      text("COPA COGUMELO", 615, 126, 102, "#fff0d0", null, undefined, 760);
    } else {
      fill("#faf1d9");
      checker(0, "#242b35", 18);
      checker(220, "#242b35", 18);
      text("MOTORES MARIO", 512, 132, 122, "#d23535", "#382a29", undefined, 950);
      c.strokeStyle = "#d23535";
      c.lineWidth = 5;
      c.strokeRect(9, 44, 1006, 165);
    }
  });
  cache.set(name, texture);
  return texture;
}
