import fetch from "node-fetch";

// === Secrets 從 GitHub Actions 環境變數讀取 ===
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_USER_ID = process.env.LINE_USER_ID;

// 抓取 To Do / Doing 任務
async function getTasks() {
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    body: JSON.stringify({
      filter: {
        or: [
          { property: "Status", select: { equals: "To Do" } },
          { property: "Status", select: { equals: "Doing" } }
        ]
      }
    })
  });

  const data = await res.json();
  return data.results.map(page => {
    const title = page.properties.Name.title[0]?.plain_text || "未命名任務";
    const status = page.properties.Status.select?.name || "";
    return `[${status}] ${title}`;
  });
}

// 發送 LINE 推播
async function pushToLine(message) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify({
      to: LINE_USER_ID,
      messages: [{ type: "text", text: message }]
    })
  });
}

// 主流程
(async () => {
  const tasks = await getTasks();
  const message = tasks.length > 0
    ? `📌 今日任務清單：\n${tasks.join("\n")}`
    : "✅ 今天沒有任務 🎉";

  await pushToLine(message);
  console.log("推播完成！");
})();
