/** @typedef {{ name: string, tags: string[] }} Topic */

let topics = /** @type {Topic[]} */ ([]);

function parseLine(line) {
  // 例: "メガホン | 小物,家具"
  // 空行やコメントは呼び出し側で除外済み想定
  const parts = line.split("|").map(s => s.trim());
  const name = parts[0] ?? "";
  const tagsPart = parts[1] ?? "";
  const tags = tagsPart
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  return { name, tags };
}

function parseTopics(text) {
  const lines = text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("#"));

  const list = [];
  for (const line of lines) {
    const t = parseLine(line);
    if (!t.name) continue;
    // タグ無しも許可（その場合はどのチェックでも出ない）
    list.push(t);
  }
  return list;
}

async function loadTopics() {
  const res = await fetch("./topics.txt", { cache: "no-store" });
  if (!res.ok) throw new Error("topics.txt を読み込めませんでした");
  const text = await res.text();
  topics = parseTopics(text);

  updateCountInfo();
  setResult(`準備OK（全${topics.length}件）`);
}

function setResult(text) {
  document.getElementById("result").textContent = text;
}

function getSelectedTags() {
  const selected = [];
  document.querySelectorAll("#toggles .toggle").forEach(label => {
    const tag = label.getAttribute("data-tag");
    const checkbox = label.querySelector("input[type=checkbox]");
    if (tag && checkbox && checkbox.checked) selected.push(tag);
  });
  return selected;
}

function filterByTags_OR(selectedTags) {
  if (!selectedTags || selectedTags.length === 0) return [];
  const set = new Set(selectedTags);
  return topics.filter(t => t.tags.some(tag => set.has(tag)));
}

function updateCountInfo() {
  const selected = getSelectedTags();
  const filtered = filterByTags_OR(selected);
  const info = document.getElementById("countInfo");
  if (selected.length === 0) {
    info.textContent = "カテゴリが未選択です（1つ以上オンにしてね）";
  } else {
    info.textContent = `選択中: ${selected.join(" / ")}　→ 抽選候補: ${filtered.length}件`;
  }
}

function drawOne() {
  const selected = getSelectedTags();
  const pool = filterByTags_OR(selected);

  if (selected.length === 0) {
    setResult("カテゴリを1つ以上オンにしてね。");
    updateCountInfo();
    return;
  }
  if (pool.length === 0) {
    setResult("その組み合わせに該当するお題がありません。topics.txt を増やしてね。");
    updateCountInfo();
    return;
  }

  const i = Math.floor(Math.random() * pool.length);
  setResult(pool[i].name);
  updateCountInfo();
}

/** トグル風の見た目同期 */
function syncToggleVisual(label) {
  const checkbox = label.querySelector("input[type=checkbox]");
  if (!checkbox) return;
  label.classList.toggle("checked", checkbox.checked);
}

function setupToggles() {
  document.querySelectorAll("#toggles .toggle").forEach(label => {
    const checkbox = label.querySelector("input[type=checkbox]");
    if (!checkbox) return;

    // 初期見た目
    syncToggleVisual(label);

    // クリックで手動トグル（これが一番確実）
    label.addEventListener("click", (e) => {
      e.preventDefault(); // labelのデフォルト挙動に頼らない
      checkbox.checked = !checkbox.checked;
      syncToggleVisual(label);
      updateCountInfo();
    });
  });
}


document.getElementById("drawBtn").addEventListener("click", drawOne);
document.getElementById("reloadBtn").addEventListener("click", () => {
  loadTopics().catch(err => setResult(err.message));
});

setupToggles();
loadTopics().catch(err => setResult(err.message));

