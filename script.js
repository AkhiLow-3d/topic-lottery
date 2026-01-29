let topics = [];

function parseLines(text) {
  return text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("#")); // 空行と # コメントを無視
}

async function loadTopics() {
  const res = await fetch("./topics.txt", { cache: "no-store" });
  if (!res.ok) throw new Error("topics.txt を読み込めませんでした");
  const text = await res.text();
  topics = parseLines(text);

  const resultEl = document.getElementById("result");
  if (topics.length === 0) {
    resultEl.textContent = "topics.txt が空です（1行1お題で書いてね）";
  } else {
    resultEl.textContent = `準備OK（${topics.length}件）`;
  }
}

function drawOne() {
  const resultEl = document.getElementById("result");
  if (!topics || topics.length === 0) {
    resultEl.textContent = "お題がありません。topics.txt を確認してね。";
    return;
  }
  const i = Math.floor(Math.random() * topics.length);
  resultEl.textContent = topics[i];
}

document.getElementById("drawBtn").addEventListener("click", drawOne);
document.getElementById("reloadBtn").addEventListener("click", loadTopics);

loadTopics().catch(err => {
  document.getElementById("result").textContent = err.message;
});
