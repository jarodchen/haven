require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const crypto = require("crypto");
const {globSync} = require("glob");

const themeCommentRegex = /\/\*[\s\S]*?\*\//g;

async function getTheme() {
  let themeUrl = process.env.THEME;
  if (!themeUrl) {
    console.log("[get-theme] No THEME env var set, skipping download.");
    return;
  }

  // Check for an existing cached theme file; if the download fails we keep it.
  const existing = globSync("src/site/styles/_theme.*.css");

  try {
    //https://forum.obsidian.md/t/1-0-theme-migration-guide/42537
    //Not all themes with no legacy mark have a theme.css file, so we need to check for it
    try {
      await axios.get(themeUrl, { timeout: 15000 });
    } catch {
      if (themeUrl.indexOf("theme.css") > -1) {
        themeUrl = themeUrl.replace("theme.css", "obsidian.css");
      } else if (themeUrl.indexOf("obsidian.css") > -1) {
        themeUrl = themeUrl.replace("obsidian.css", "theme.css");
      }
    }

    const res = await axios.get(themeUrl, { timeout: 30000 });
    existing.forEach((file) => {
      fs.rmSync(file);
    });
    let skippedFirstComment = false;
    const data = res.data.replace(themeCommentRegex, (match) => {
      if (skippedFirstComment) {
        return "";
      } else {
        skippedFirstComment = true;
        return match;
      }
    });
    const hashSum = crypto.createHash("sha256");
    hashSum.update(data);
    const hex = hashSum.digest("hex");
    fs.writeFileSync(`src/site/styles/_theme.${hex.substring(0, 8)}.css`, data);
    console.log(`[get-theme] Downloaded theme from ${themeUrl}`);
  } catch (err) {
    // Network failures (especially raw.githubusercontent.com in some regions)
    // must not abort the whole build. Keep the previously cached theme file.
    if (existing.length > 0) {
      console.warn(`[get-theme] Download failed (${err.code || err.message}), using cached theme: ${existing[0]}`);
    } else {
      console.warn(`[get-theme] Download failed (${err.code || err.message}) and no cached theme found; site will use base styles only.`);
    }
  }
}

getTheme();
