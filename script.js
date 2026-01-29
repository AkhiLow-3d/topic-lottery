/** @typedef {{ name: string, tags: string[] }} Topic */

let presetTopics = /** @type {Topic[]} */ ([]);

const USER_STORAGE_KEY = "topic_lottery_user_topics_v1";

function setResult(text) {
  document.getElementById("result").textContent = text;
}

function parseLine(line) {
  // 例: "メガホン | 小物,家具"
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
    list.push(t);
  }
  return list;
}

async function loadPresetTopics() {
  const res = await fetch("./topics.txt", { cache: "no-store" });
  if (!res.ok) throw new Error("topics.txt を読み込めませんでした");
  const text = await res.text();
  presetTopics = parseTopics(text);

  updateCountInfo();
  const total = mergedTopics().length;
  setResult(`準備OK（合計${total}件）`);
}

/* ---- ユーザーお題（localStorage） ---- */

function exportUserTopicsText() {
  return localStorage.getItem(USER_STORAGE_KEY) ?? "";
}

function loadUserTopics() {
  try {
    const raw = exportUserTopicsText();
    if (!raw) return [];
    return parseTopics(raw);
  } catch {
    return [];
  }
}

function saveUserTopicsFromText(text) {
  localStorage.setItem(USER_STORAGE_KEY, text);
}

function mergedTopics() {
  // プリセット + ユーザー を合体（同名はユーザー優先）
  const user = loadUserTopics();
  const map = new Map();

  for (const t of presetTopics) map.set(t.name, t);
  for (const t of user) map.set(t.name, t);

  return Array.from(map.values());
}

/* ---- 絞り込み（OR） ---- */

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
  const all = mergedTopics();
  return all.filter(t => t.tags.some(tag => set.has(tag)));
}

function updateCountInfo() {
  const selected = getSelectedTags();
  const filtered = filterByTags_OR(selected);
  const info = document.getElementById("countInfo");

  const totalPreset = presetTopics.length;
  const totalUser = loadUserTopics().length;
  const totalMerged = mergedTopics().length;

  if (selected.length === 0) {
    info.textContent = `カテゴリ未選択です（合計 ${totalMerged}件 / プリセット${totalPreset} + ユーザー${totalUser}）`;
  } else {
    info.textContent =
      `選択中: ${selected.join(" / ")} → 抽選候補: ${filtered.length}件　` +
      `（合計 ${totalMerged}件 / プリセット${totalPreset} + ユーザー${totalUser}）`;
  }
}

/* ---- 抽選 ---- */

function drawOne() {
  const selected = getSelectedTags();
  const pool = filterByTags_OR(selected);

  if (selected.length === 0) {
    setResult("カテゴリを1つ以上オンにしてね。");
    updateCountInfo();
    return;
  }
  if (pool.length === 0) {
    setResult("その組み合わせに該当するお題がありません。topics.txt / ユーザーお題を増やしてね。");
    updateCountInfo();
    return;
  }

  const i = Math.floor(Math.random() * pool.length);
  setResult(pool[i].name);
  updateCountInfo();
}

/* ---- トグル見た目同期 ---- */

function syncToggleVisual(label) {
  const checkbox = label.querySelector("input[type=checkbox]");
  if (!checkbox) return;
  label.classList.toggle("checked", checkbox.checked);
}

function setupCategoryToggles() {
  document.querySelectorAll("#toggles .toggle").forEach(label => {
    const checkbox = label.querySelector("input[type=checkbox]");
    if (!checkbox) return;

    syncToggleVisual(label);

    // 手動トグル（確実に動く）
    label.addEventListener("click", (e) => {
      e.preventDefault();
      checkbox.checked = !checkbox.checked;
      syncToggleVisual(label);
      updateCountInfo();
    });
  });
}

/* ---- ダウンロード（エクスポート） ---- */

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---- ユーザーエディタ ---- */

function setupUserEditor() {
  const editor = document.getElementById("editor");
  const userText = document.getElementById("userText");

  document.getElementById("openEditorBtn").addEventListener("click", () => {
    editor.style.display = "block";
    userText.value = exportUserTopicsText();
  });

  document.getElementById("closeEditorBtn").addEventListener("click", () => {
    editor.style.display = "none";
  });

  document.getElementById("saveUserBtn").addEventListener("click", () => {
    const text = userText.value ?? "";
    const parsed = parseTopics(text);

    // 空はOK（全削除と同義）
    if (text.trim().length > 0 && parsed.length === 0) {
      setResult("保存できません：形式が崩れてるかも（例：メガホン | 小物,家具）");
      return;
    }

    saveUserTopicsFromText(text);
    setResult(`ユーザーお題を保存しました（${parsed.length}件）`);
    updateCountInfo();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const text = exportUserTopicsText();
    downloadText("my_topics.txt", text);
  });

  document.getElementById("clearUserBtn").addEventListener("click", () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    userText.value = "";
    setResult("ユーザーお題を全削除しました");
    updateCountInfo();
  });

  // 置換トグルをトグル風に
  const replaceLabel = document.getElementById("replaceModeLabel");
  const replaceCb = document.getElementById("replaceMode");
  const syncReplace = () => replaceLabel.classList.toggle("checked", replaceCb.checked);
  syncReplace();
  replaceLabel.addEventListener("click", (e) => {
    e.preventDefault();
    replaceCb.checked = !replaceCb.checked;
    syncReplace();
  });

  // インポート
  document.getElementById("importBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("importFile");
    const replace = replaceCb.checked;
    const file = fileInput.files?.[0];

    if (!file) {
      setResult("インポートするtxtファイルを選んでね");
      return;
    }

    const text = await file.text();
    const imported = parseTopics(text);

    if (imported.length === 0) {
      setResult("インポート失敗：中身が空か、形式が違うかも");
      return;
    }

    if (replace) {
      saveUserTopicsFromText(text);
      setResult(`インポート（置換）しました（${imported.length}件）`);
    } else {
      // 追加（同名は後勝ち）
      const current = loadUserTopics();
      const map = new Map();
      for (const t of current) map.set(t.name, t);
      for (const t of imported) map.set(t.name, t);

      const mergedText = Array.from(map.values())
        .map(t => `${t.name} | ${t.tags.join(",")}`)
        .join("\n");

      saveUserTopicsFromText(mergedText);
      setResult(`インポート（追加）しました（合体後 ${map.size}件）`);
    }

    updateCountInfo();
  });
}

/* ---- 初期化 ---- */

document.getElementById("drawBtn").addEventListener("click", drawOne);
document.getElementById("reloadBtn").addEventListener("click", () => {
  loadPresetTopics().catch(err => setResult(err.message));
});

setupCategoryToggles();
setupUserEditor();

loadPresetTopics().catch(err => setResult(err.message));
