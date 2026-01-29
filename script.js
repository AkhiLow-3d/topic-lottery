/** @typedef {{ name: string, tags: string[] }} Topic */

let presetTopics = /** @type {Topic[]} */ ([]);

const USER_STORAGE_KEY = "topic_lottery_user_topics_v1";

// 固定カテゴリ（あなたの最初の設計は残す）
const FIXED_TAGS = ["家具", "小物", "乗り物"];

function setResult(text) {
  document.getElementById("result").textContent = text;
}

/* ---- パース ---- */

function normalizeTag(tag) {
  // 最低限の揺れ対策：前後空白を除去
  // （全角半角の統一や小文字化などは、必要になったら追加）
  return (tag ?? "").trim();
}

function parseLine(line) {
  // 例: "メガホン | 小物,家具"
  const parts = line.split("|").map(s => s.trim());
  const name = parts[0] ?? "";
  const tagsPart = parts[1] ?? "";
  const tags = tagsPart
    .split(",")
    .map(normalizeTag)
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

  rebuildTagToggles(); // ★タグUIを再構築
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

/* ---- タグ一覧（自動生成） ---- */

function allTagsFromMerged() {
  const all = mergedTopics();
  const set = new Set();

  for (const t of all) {
    for (const tag of t.tags) set.add(normalizeTag(tag));
  }

  // 空や重複は排除済み。固定タグは別扱いにしたいので後で引く
  return Array.from(set).filter(Boolean);
}

/* ---- トグルUI生成 ---- */

function makeToggleEl(tag, checked = false) {
  const label = document.createElement("label");
  label.className = "toggle";
  label.setAttribute("data-tag", tag);

  const pill = document.createElement("span");
  pill.className = "pill";

  const text = document.createElement("span");
  text.textContent = tag;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;

  label.appendChild(pill);
  label.appendChild(text);
  label.appendChild(input);

  // 手動トグル（確実）
  label.addEventListener("click", (e) => {
    e.preventDefault();
    input.checked = !input.checked;
    syncToggleVisual(label);
    updateCountInfo();
  });

  syncToggleVisual(label);
  return label;
}

function syncToggleVisual(label) {
  const checkbox = label.querySelector("input[type=checkbox]");
  if (!checkbox) return;
  label.classList.toggle("checked", checkbox.checked);
}

function getSelectedTags() {
  const selected = [];
  document.querySelectorAll(".toggle").forEach(label => {
    const tag = label.getAttribute("data-tag");
    const checkbox = label.querySelector("input[type=checkbox]");
    if (tag && checkbox && checkbox.checked) selected.push(tag);
  });
  return selected;
}

function clearAllChecks() {
  document.querySelectorAll(".toggle").forEach(label => {
    const checkbox = label.querySelector("input[type=checkbox]");
    if (!checkbox) return;
    checkbox.checked = false;
    syncToggleVisual(label);
  });
  updateCountInfo();
}

function rebuildTagToggles() {
  const fixedBox = document.getElementById("fixedToggles");
  const dynBox = document.getElementById("dynamicToggles");
  const otherBox = document.getElementById("otherTagsBox");

  // 今の選択状態を保持したいので、既存のONタグを覚える
  const prevSelected = new Set(getSelectedTags());

  fixedBox.innerHTML = "";
  dynBox.innerHTML = "";

  // 固定タグ（存在しなくても表示）
  for (const tag of FIXED_TAGS) {
    const isChecked = prevSelected.has(tag) || prevSelected.size === 0; // 初回は全部ON寄り
    fixedBox.appendChild(makeToggleEl(tag, isChecked));
  }

  // 自由タグ（mergedTopics から収集して、固定タグを除外）
  const allTags = allTagsFromMerged();
  const dynamicTags = allTags
    .filter(t => !FIXED_TAGS.includes(t))
    .sort((a, b) => a.localeCompare(b, "ja"));

  for (const tag of dynamicTags) {
    const isChecked = prevSelected.has(tag);
    dynBox.appendChild(makeToggleEl(tag, isChecked));
  }

  // 自由タグが無ければ折りたたみを隠す
  otherBox.style.display = dynamicTags.length === 0 ? "none" : "block";
}

/* ---- 絞り込み（OR） ---- */

function filterByTags_OR(selectedTags) {
  if (!selectedTags || selectedTags.length === 0) return [];
  const set = new Set(selectedTags);
  const all = mergedTopics();
  return all.filter(t => t.tags.some(tag => set.has(tag)));
}

/* ---- 表示更新 ---- */

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
      setResult("保存できません：形式が崩れてるかも（例：あいうえお | 文字）");
      return;
    }

    saveUserTopicsFromText(text);

    rebuildTagToggles(); // ★新タグがあれば増える
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

    rebuildTagToggles(); // ★タグUI再構築
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

    rebuildTagToggles(); // ★タグUI再構築
    updateCountInfo();
  });
}

/* ---- 初期化 ---- */

document.getElementById("drawBtn").addEventListener("click", drawOne);
document.getElementById("reloadBtn").addEventListener("click", () => {
  loadPresetTopics().catch(err => setResult(err.message));
});
document.getElementById("clearChecksBtn").addEventListener("click", clearAllChecks);

setupUserEditor();

// プリセット読み込み → タグUI構築 → 動作開始
loadPresetTopics().catch(err => setResult(err.message));
