import fs from "fs";
import path from "path";

const transcriptPath =
  "C:/Users/KavishMojhoa-Zapproa/.cursor/projects/c-Users-KavishMojhoa-Zapproa-Documents-mkinvoicing/agent-transcripts/07754de2-56ac-4474-b444-8ac7b726ce15/07754de2-56ac-4474-b444-8ac7b726ce15.jsonl";
const outDir = "C:/Users/KavishMojhoa-Zapproa/Documents/mkinvoicing/.erp-recovery";
const REVERT_LINE = 104;

const lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
const files = {};
const ops = [];

for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  if (lineNum >= REVERT_LINE) break;
  let obj;
  try {
    obj = JSON.parse(lines[i]);
  } catch {
    continue;
  }
  const content = obj?.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block.type !== "tool_use") continue;
    const inp = block.input || {};
    const p = (inp.path || "").replace(/\\/g, "/").toLowerCase();
    if (block.name === "Write" && inp.contents) {
      files[p] = inp.contents;
      ops.push({ line: lineNum, type: "Write", path: p, len: inp.contents.length });
    } else if (block.name === "StrReplace" && inp.path) {
      ops.push({
        line: lineNum,
        type: "StrReplace",
        path: p,
        old: inp.old_string,
        new: inp.new_string,
      });
    }
  }
}

let applied = 0;
let missed = 0;
for (const op of ops) {
  if (op.type !== "StrReplace") continue;
  const cur = files[op.path];
  if (cur === undefined || !cur.includes(op.old)) {
    missed++;
    console.error("MISSING StrReplace line", op.line, op.path);
    continue;
  }
  files[op.path] = cur.replace(op.old, op.new);
  applied++;
}

fs.mkdirSync(outDir, { recursive: true });

const map = [
  ["components/credit-note-form.tsx", "credit-note-form.tsx"],
  ["lib/credit-notes-service.ts", "credit-notes-service.ts"],
  ["app/app/credit-notes/new/page.tsx", "credit-notes-new-page.tsx"],
  ["app/app/credit-notes/[id]/edit/page.tsx", "credit-notes-edit-page.tsx"],
  ["components/credit-note-view-actions.tsx", "credit-note-view-actions.tsx"],
  ["components/credit-note-status-badge.tsx", "credit-note-status-badge.tsx"],
];

for (const [needle, outName] of map) {
  const key = needle.toLowerCase();
  const found = Object.entries(files).find(([p]) => p.endsWith(key) || p.includes(key));
  if (found) {
    fs.writeFileSync(path.join(outDir, outName), found[1]);
    console.log("OK", outName, found[1].length, "chars (from line", ops.filter((o) => o.type === "Write" && o.path === found[0]).pop()?.line ?? "?)", ")");
  } else {
    console.log("MISSING", needle);
  }
}

console.log("StrReplace applied:", applied, "missed:", missed);
console.log("All writes before revert:");
for (const o of ops.filter((x) => x.type === "Write")) {
  console.log(" ", o.line, o.path.split("mkinvoicing/").pop(), o.len);
}
