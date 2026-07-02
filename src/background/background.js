chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  if (message.type === "BP_FETCH_HTML") {
    fetchHtmlWithRetry(message.url, 3)
      .then(html => {
        sendResponse({
          ok: true,
          html
        });
      })
      .catch(error => {
        console.error("[BasketPulse Helper] fetch error:", error);

        sendResponse({
          ok: false,
          error: error.message || String(error)
        });
      });

    return true;
  }
});

async function fetchHtmlWithRetry(url, maxRetry) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      return await fetchHtml(url);
    } catch (error) {
      lastError = error;

      const message = error.message || String(error);

      const shouldRetry =
        message.includes("HTTP 502") ||
        message.includes("HTTP 503") ||
        message.includes("HTTP 504") ||
        message.includes("Failed to fetch") ||
        message.includes("NetworkError");

      if (!shouldRetry || attempt >= maxRetry) {
        break;
      }

      await sleep(1200 * attempt);
    }
  }

  throw lastError || new Error("fetch failed");
}

async function fetchHtml(url) {
  if (!url || !url.startsWith("https://www.basketpulse.com/")) {
    throw new Error("不允許的 URL：" + url);
  }

  const response = await fetch(url, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
