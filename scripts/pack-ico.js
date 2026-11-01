const fs = require("node:fs");
const path = require("node:path");

const assets = path.join(__dirname, "..", "assets");
const sizes = [16, 32, 48, 64, 128, 256];

const images = sizes.map((size) => ({
  size,
  data: fs.readFileSync(path.join(assets, `icon-${size}.png`)),
}));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

let offset = 6 + images.length * 16;

const entries = images.map(({ size, data }) => {
  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size;
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += data.length;
  return entry;
});

const ico = Buffer.concat([
  header,
  ...entries,
  ...images.map((image) => image.data),
]);

fs.writeFileSync(path.join(assets, "icon.ico"), ico);
fs.copyFileSync(
  path.join(assets, "icon-256.png"),
  path.join(assets, "icon.png")
);
console.log(`icon.ico written (${ico.length} bytes)`);
