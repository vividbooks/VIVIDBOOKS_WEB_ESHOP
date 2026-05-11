const fs = require("fs");
const p = "C:/Users/racer/.cursor/projects/c-Users-racer-Documents-GitHub-VIVIDBOOKS-WEB-ESHOP/agent-tools/7b546b6f-9ab4-46c4-92a8-d4899d88f5aa.txt";
const txt = fs.readFileSync(p, "utf8");
const parsed = JSON.parse(txt);
const src = parsed.result.files.find(f => f.name === "src/supabase/functions/server/index.tsx").content;
console.log(src.includes("app.use('/*', cors"), src.includes("app.use('*', cors"));
console.log(src.slice(src.indexOf("app.use"), src.indexOf("app.use") + 120));
console.log(src.includes("app.use('/*', logger"));
