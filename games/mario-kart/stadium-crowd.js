/** Original small spectator drawings for the physical stadium seating rows. */
export function spectatorAtlas(canvasTexture) {
  let seed = 4815;
  const rand = () =>
    ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
  return canvasTexture(2048, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const colors = ["#ce4852", "#4b81cb", "#d3ac39", "#509f75", "#a876bd"];
    const oval = (x, y, rx, ry, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    };
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 84; col++) {
        if (col % 21 < 3 || rand() < 0.07) continue;
        const x = col * (w / 84) + 12 + rand() * 2,
          y = row * 64 + 7 + rand() * 3,
          color = colors[Math.floor(rand() * colors.length)],
          coloredCap = rand() < 0.2;
        // White trousers, colored vest and a face below the overhanging cap.
        oval(x - 3.6, y + 40, 3.8, 3.1, "#b69a72");
        oval(x + 3.6, y + 40, 3.8, 3.1, "#b69a72");
        oval(x, y + 31, 6.8, 8.8, "#e8e4d9");
        oval(x, y + 26, 7, 7, color);
        c.fillStyle = "#f1d4ad";
        c.fillRect(x - 2.4, y + 22, 4.8, 11);
        oval(x, y + 18, 6.6, 7.8, "#f1d4ad");
        // Arms alternate between a seated pose and a small raised wave.
        const wave = rand() < 0.3;
        c.strokeStyle = "#e6c69a";
        c.lineWidth = 3;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(x - 6, y + 26);
        c.lineTo(x - 9, y + (wave ? 17 : 30));
        c.stroke();
        c.beginPath();
        c.moveTo(x + 6, y + 26);
        c.lineTo(x + 9, y + 29);
        c.stroke();
        oval(x, y + 7, 10.5, 9.1, coloredCap ? color : "#e8e7dd");
        const spot = coloredCap ? "#f5f0dd" : color;
        oval(x, y + 3, 3.6, 4.2, spot);
        oval(x - 7.7, y + 8, 2.3, 3.7, spot);
        oval(x + 7.7, y + 8, 2.3, 3.7, spot);
        c.fillStyle = "#423d38";
        c.fillRect(x - 3.1, y + 18, 1.6, 3);
        c.fillRect(x + 1.5, y + 18, 1.6, 3);
        c.fillStyle = "#9ca9bc55";
        c.fillRect(x - 11, y + 48, 22, 1.4);
      }
  });
}
