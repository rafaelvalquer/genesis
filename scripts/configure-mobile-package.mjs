import fs from "node:fs";

const packagePath = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

pkg.scripts = {
  ...pkg.scripts,
  "build:web": "vite build && node scripts/optimize-build-assets.mjs",
  "build:android": "vite build --mode android",
  "android:prepare": "node scripts/prepare-android-project.mjs",
  "mobile:sync": "npm run build:android && npx cap sync android && npm run android:prepare",
  "mobile:open": "npx cap open android",
  "mobile:run": "npm run mobile:sync && npx cap run android",
  "mobile:apk:win": "npm run mobile:sync && cd android && gradlew.bat assembleDebug",
  "mobile:apk:unix": "npm run mobile:sync && cd android && ./gradlew assembleDebug"
};

fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log("Mobile npm scripts added to package.json");
