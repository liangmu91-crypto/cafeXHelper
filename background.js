// background.js — service worker：存储中枢、消息中枢、标签管理

const SEED_URL = chrome.runtime.getURL("data/seed.json");

// ---------- 工具 ----------
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Fisher–Yates 洗牌
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 合并账号：完全以新数据（网页表格）的顺序为准，网页没有的旧账号丢弃。
// 保留老账号里已填过的备注（若新抓取的是占位「（待补充）」），其它字段以网页为准。
function mergeAccounts(oldList, newList) {
  const oldMap = new Map();
  for (const a of oldList) oldMap.set(a.handle, a);
  // 严格按 newList 顺序输出
  return newList.map((a) => {
    const old = oldMap.get(a.handle);
    const note =
      a.note && a.note !== "（待补充）" ? a.note : (old && old.note) || a.note;
    return { name: a.name, handle: a.handle, tweetUrl: a.tweetUrl, note };
  });
}

// ---------- 存储初始化 ----------
async function getDefaultState() {
  let seed = [];
  try {
    const res = await fetch(SEED_URL);
    seed = await res.json();
  } catch (e) {
    seed = [];
  }
  return {
    accounts: seed,
    followed: {},
    settings: { dailyCount: 10 },
    daily: { date: "", picks: [] },
    meta: { lastSyncAt: null },
  };
}

async function getStore() {
  const cur = await chrome.storage.local.get(null);
  if (!cur || !cur.accounts) {
    const def = await getDefaultState();
    await chrome.storage.local.set(def);
    return def;
  }
  return cur;
}

// ---------- 今日随机 ----------
// 仅从未关注者中按 dailyCount 随机；返回 picks（handle 列表），同时写入 daily
async function repickDaily(forceNew) {
  const store = await getStore();
  const today = todayStr();
  // 同一天且非强制重抽 → 沿用已有结果
  if (!forceNew && store.daily && store.daily.date === today && store.daily.picks.length) {
    return store.daily.picks;
  }
  const unfollowed = store.accounts.filter((a) => !store.followed[a.handle]);
  const pool = shuffle(unfollowed);
  const count = Math.min(store.settings.dailyCount, pool.length);
  const picks = pool.slice(0, count).map((a) => a.handle);
  store.daily = { date: today, picks };
  await chrome.storage.local.set({ daily: store.daily });
  return picks;
}

// 在页面里执行的抓取函数（被 executeScript 序列化注入，返回账号数组）
function grabAccountsInPage() {
  // 定位含「博主/优质/一句话」签名的表格
  const tables = document.querySelectorAll("table");
  let target = null;
  for (const t of tables) {
    const ht = (t.querySelector("thead")?.textContent || "").replace(/\s+/g, "");
    if (ht.includes("博主") && ht.includes("优质") && ht.includes("一句话")) { target = t; break; }
  }
  if (!target) return { ok: false, reason: "no-table" };

  const rows = target.querySelectorAll("tbody tr, tr");
  const accounts = [];
  const seen = new Set();
  for (const tr of rows) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 4) continue;
    const name = (tds[0].textContent || "").trim();
    const accLink = tds[1].querySelector("a");
    const postLink = tds[2].querySelector("a");
    const note = (tds[3].textContent || "").trim();
    const accHref = accLink?.getAttribute("href") || "";
    const handle = (accHref.match(/x\.com\/([^/?#]+)/) || [])[1] || "";
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    accounts.push({ name, handle, tweetUrl: postLink?.getAttribute("href") || "", note });
  }
  return accounts.length ? { ok: true, accounts } : { ok: false, reason: "empty-table" };
}

// 立即同步：直接在当前激活标签页执行抓取函数，不依赖 content script、不跳转
async function syncFromCurrentTab() {
  let active;
  try {
    // lastFocusedWindow：弹窗打开时 currentWindow 会指向弹窗上下文，取不到真实标签页
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    active = tabs && tabs[0];
  } catch (e) {
    return { ok: false, reason: "no-active-tab" };
  }
  const url = (active && active.url) || "";
  if (!active || !/(^|\.)web\.cafe\//.test(url)) {
    // 兼容 new.web.cafe
    if (!active || !/^https:\/\/[a-z.]*web\.cafe\//.test(url)) {
      return { ok: false, reason: "not-webcafe", url };
    }
  }

  // 表格可能稍后才渲染，简单重试几次
  let result;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: active.id },
        func: grabAccountsInPage,
      });
      result = r && r.result;
    } catch (e) {
      return { ok: false, reason: "inject-failed", detail: String(e && e.message) };
    }
    if (result && result.ok) break;        // 抓到了
    if (result && !result.ok && result.reason !== "no-table" && result.reason !== "empty-table") break; // 明确失败
    await new Promise((res) => setTimeout(res, 700)); // 等待渲染后重试
  }

  if (result && result.ok) {
    const store = await getStore();
    const merged = mergeAccounts(store.accounts, result.accounts);
    await chrome.storage.local.set({
      accounts: merged,
      meta: { ...store.meta, lastSyncAt: new Date().toISOString() },
    });
    return { ok: true, count: merged.length };
  }
  return { ok: false, reason: (result && result.reason) || "no-response" };
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case "ACCOUNTS_SCRAPED": {
        const store = await getStore();
        const merged = mergeAccounts(store.accounts, msg.accounts);
        await chrome.storage.local.set({
          accounts: merged,
          meta: { ...store.meta, lastSyncAt: new Date().toISOString() },
        });
        sendResponse({ ok: true, count: merged.length });
        break;
      }
      case "START_MANUAL_SYNC": {
        const result = await syncFromCurrentTab();
        sendResponse(result);
        break;
      }
      case "GET_STATE": {
        const store = await getStore();
        sendResponse(store);
        break;
      }
      case "RE_PICK": {
        const picks = await repickDaily(true);
        sendResponse({ picks });
        break;
      }
      case "ENSURE_DAILY": {
        const picks = await repickDaily(false);
        sendResponse({ picks });
        break;
      }
      case "FOLLOW_PICKS": {
        // 一键关注：把今日 picks 全部标记
        const store = await getStore();
        const handles = msg.handles || (store.daily && store.daily.picks) || [];
        const followed = { ...store.followed };
        for (const h of handles) followed[h] = true;
        await chrome.storage.local.set({ followed });
        sendResponse({ ok: true, followed });
        break;
      }
      case "SET_FOLLOWED": {
        const store = await getStore();
        const followed = { ...store.followed };
        if (msg.value) followed[msg.handle] = true;
        else delete followed[msg.handle];
        await chrome.storage.local.set({ followed });
        sendResponse({ ok: true, followed });
        break;
      }
      case "SET_SETTINGS": {
        const store = await getStore();
        const settings = { ...store.settings, ...msg.settings };
        await chrome.storage.local.set({ settings });
        sendResponse({ ok: true, settings });
        break;
      }
      case "OPEN_PANEL": {
        // 打开/聚焦右侧侧边面板
        try {
          await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
        } catch (e) {}
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown" });
    }
  })();
  return true; // 异步响应
});

// 点击工具栏图标 → 打开右侧侧边面板
chrome.runtime.onInstalled.addListener(async () => {
  await getStore();
  // 允许点击工具栏图标时打开侧边面板
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (e) {}
});

// 启动时确保有数据
chrome.runtime.onStartup.addListener(async () => {
  await getStore();
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (e) {}
});
