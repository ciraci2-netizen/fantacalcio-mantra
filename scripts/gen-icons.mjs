import sharp from "sharp";
import { readFileSync } from "fs";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="80" fill="#15803d"/>
  <circle cx="256" cy="220" r="160" fill="white" opacity="0.15"/>
  <text x="256" y="300" font-size="220" text-anchor="middle" font-family="serif">&#x26BD;</text>
  <text x="256" y="460" font-size="100" text-anchor="middle" font-family="Arial,sans-serif" fill="white" font-weight="bold">IPA</text>
</svg>`;

const buf = Buffer.from(svg);
await sharp(buf).resize(512, 512).png().toFile("public/icon-512.png");
console.log("icon-512.png created");
await sharp(buf).resize(192, 192).png().toFile("public/icon-192.png");
console.log("icon-192.png created");
