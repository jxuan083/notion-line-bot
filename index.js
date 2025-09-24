import fetch from "node-fetch";

// === Secrets 從 GitHub Actions 環境變數讀取 ===
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_USER_ID = process.env.LINE_USER_ID;

// 抓取 Life / Work / Doing 任務
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
          { property: "Status", select: { equals: "Life" } },
          { property: "Status", select: { equals: "Work" } },
          { property: "Status", select: { equals: "Doing" } }
        ]
      }
    })
  });

  const data = await res.json();
  return data.results.map(page => {
    const title = page.properties.Name.title[0]?.plain_text || "未命名任務";
    const status = page.properties.Status.select?.name || "";
    return { title, status };
  });
}

// 發送 LINE Flex Message
async function pushToLineFlex(tasks) {
  // 統計數量
  const total = tasks.length;
  const lifeCount = tasks.filter(t => t.status === "Life").length;
  const workCount = tasks.filter(t => t.status === "Work").length;
  const doingCount = tasks.filter(t => t.status === "Doing").length;

  // 把任務轉換成 Flex 元素
  const taskContents = tasks.map(task => {
    let color = "#000000"; // 預設黑
    if (task.status === "Life") color = "#1E90FF";   // 藍色
    if (task.status === "Work") color = "#FF8C00";  // 橘色
    if (task.status === "Doing") color = "#32CD32"; // 綠色

    return {
      type: "box",
      layout: "baseline",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: task.status,
          size: "sm",
          color: color,
          flex: 2,
          weight: "bold"
        },
        {
          type: "text",
          text: task.title,
          size: "sm",
          color: "#555555",
          flex: 8,
          wrap: true
        }
      ]
    };
  });

  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "📌 今日任務清單",
          weight: "bold",
          size: "lg"
        },
        {
          type: "text",
          text: `共 ${total} 項（Life: ${lifeCount}, Work: ${workCount}, Doing: ${doingCount})`,
          size: "sm",
          color: "#888888",
          margin: "sm"
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: taskContents.length > 0
            ? taskContents
            : [{ type: "text", text: "✅ 今天沒有任務 🎉", size: "sm", color: "#888888" }]
        }
      ]
    }
  };

  const flexMessage = {
    type: "flex",
    altText: "今日任務清單",
    contents: bubble
  };

  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify({
      to: LINE_USER_ID,
      messages: [flexMessage]
    })
  });
}

// 主流程
(async () => {
  const tasks = await getTasks();
  await pushToLineFlex(tasks);
  console.log("推播完成！");
})();
