// content.js — web.cafe 沉淀帖抓取器
// 注入整个 web.cafe 站点；当当前页确实包含目标表格时才抓取。
// 支持两种触发：页面加载后自动尝试；收到 SYNC_FROM_TAB 消息时主动抓取。

// 定位含「博主/优质 Post/一句话说明」签名的表格
function findTargetTable() {
  const tables = document.querySelectorAll("table");
  for (const t of tables) {
    const headerText = (t.querySelector("thead")?.textContent || "").replace(/\s+/g, "");
    if (
      headerText.includes("博主") &&
      headerText.includes("优质") &&
      headerText.includes("一句话")
    ) {
      return t;
    }
  }
  return null;
}

function extractAccounts() {
  const table = findTargetTable();
  if (!table) return null;

  const rows = table.querySelectorAll("tbody tr, tr");
  const accounts = [];
  const seen = new Set();

  for (const tr of rows) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 4) continue; // 跳过表头/异常行

    const name = (tds[0].textContent || "").trim();
    const accLink = tds[1].querySelector("a");
    const postLink = tds[2].querySelector("a");
    const note = (tds[3].textContent || "").trim();

    const accHref = accLink?.getAttribute("href") || "";
    const handle = (accHref.match(/x\.com\/([^/?#]+)/) || [])[1] || "";
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);

    const tweetUrl = postLink?.getAttribute("href") || "";
    accounts.push({ name, handle, tweetUrl, note });
  }

  return accounts.length ? accounts : null;
}

// 轮询等待 SPA 水合完成
function waitForTable(timeoutMs = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      const accounts = extractAccounts();
      if (accounts) return resolve(accounts);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(check, 600);
    }
    check();
  });
}

// 把抓到的数据回写存储
async function pushAccounts(accounts) {
  if (!accounts) return { ok: false, reason: "no-table" };
  try {
    const res = await chrome.runtime.sendMessage({ type: "ACCOUNTS_SCRAPED", accounts });
    return { ok: true, count: accounts.length, ...res };
  } catch (e) {
    return { ok: false, reason: "msg-failed" };
  }
}

// 响应来自 background 的主动抓取请求（当前标签页）
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "SYNC_FROM_TAB") {
    (async () => {
      const accounts = extractAccounts() || (await waitForTable(8000));
      const result = await pushAccounts(accounts);
      sendResponse(result);
    })();
    return true; // 异步响应
  }
});

// 页面加载后自动尝试抓取（仅在确有目标表格时写入）
(async function autoRun() {
  const accounts = await waitForTable(6000);
  if (accounts) await pushAccounts(accounts);
})();
