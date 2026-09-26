import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R = L.map((code) => [...code].map((bit) => (bit === "0" ? "1" : "0")).join(""));
const G = R.map((code) => [...code].reverse().join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

const ean13Modules = (digits) => {
  if (!/^\d{13}$/u.test(digits)) {
    throw new Error("EAN-13 needs 13 digits");
  }

  const parity = PARITY[Number(digits[0])];
  let modules = "101";

  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(digits[index]);
    modules += parity[index - 1] === "L" ? L[digit] : G[digit];
  }

  modules += "01010";

  for (let index = 7; index <= 12; index += 1) {
    modules += R[Number(digits[index])];
  }

  return `${modules}101`;
};

export const writeFakeBarcodeCamera = (digits, { width = 640, height = 480, moduleWidth = 4 } = {}) => {
  const modules = ean13Modules(digits);
  const luma = Buffer.alloc(width * height, 235);
  const barcodeWidth = modules.length * moduleWidth;
  const left = Math.floor((width - barcodeWidth) / 2);
  const top = Math.floor(height * 0.25);
  const bottom = Math.floor(height * 0.75);

  for (let y = top; y < bottom; y += 1) {
    for (let index = 0; index < modules.length; index += 1) {
      if (modules[index] !== "1") {
        continue;
      }

      const start = y * width + left + index * moduleWidth;
      luma.fill(16, start, start + moduleWidth);
    }
  }

  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), luma, chroma]);
  const file = path.join(tmpdir(), `fake-barcode-camera-${digits}.y4m`);

  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`),
      frame,
      frame,
    ]),
  );

  return file;
};
