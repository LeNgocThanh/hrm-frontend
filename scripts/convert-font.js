// scripts/convert-font.js
import fs from "fs";

const fontPath = "./public/fonts/NotoSans-Regular.ttf";
const outputPath = "./public/fonts/NotoSans-Regular.js";

const fontData = fs.readFileSync(fontPath).toString("base64");
const jsContent = `export default "${fontData}";`;

fs.writeFileSync(outputPath, jsContent);
console.log("✅ Font converted to base64:", outputPath);
