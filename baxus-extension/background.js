importScripts(chrome.runtime.getURL('fuzzball.umd.min.js'));

let baxusCatalog = null;

// Fetch the BAXUS catalog from the API
async function fetchBaxusCatalog() {
  const PAGE_SIZE = 1000;
  const MAX_RETRIES = 3;
  let bottles = [];
  let fromIdx = 0;

  while (true) {
    const url = `https://services.baxus.co/api/search/listings?from=${fromIdx}&size=${PAGE_SIZE}&listed=true`;
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 429) {
            retries++;
            const waitTime = Math.pow(2, retries); // Exponential backoff
            console.log(`Rate limited. Waiting ${waitTime}s before retry ${retries}/${MAX_RETRIES}`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            continue;
          }
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (data.length === 0) {
          console.log(`Fetched ${bottles.length} bottles total`);
          return bottles;
        }
        for (const listing of data) {
          const bottle = listing._source;
          const attributes = bottle.attributes || {};
          bottles.push({
            id: bottle.id || "",
            name: bottle.name || "",
            price: bottle.price || 0,
            producer: attributes.Producer || "",
            yearBottled: attributes["Year Bottled"] || "",
            abv: attributes.ABV || "",
            imageUrl: bottle.imageUrl || ""
          });
        }
        fromIdx += PAGE_SIZE;
        console.log(`Fetched ${bottles.length} bottles so far...`);
        break;
      } catch (error) {
        console.error(`Fetch error at fromIdx ${fromIdx}:`, error);
        if (retries >= MAX_RETRIES - 1) {
          console.log("Max retries reached, returning partial catalog");
          return bottles;
        }
        retries++;
        const waitTime = Math.pow(2, retries);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }
  }
}

// Update and store the catalog
async function updateCatalog() {
  try {
    const bottles = await fetchBaxusCatalog();
    const catalog = {
      last_updated: new Date().toISOString(),
      total_bottles: bottles.length,
      bottles: bottles
    };
    await chrome.storage.local.set({ baxusCatalog: catalog });
    baxusCatalog = bottles;
    console.log("Catalog updated successfully");
  } catch (error) {
    console.error("Failed to update catalog:", error);
    // Keep existing catalog if fetch fails
  }
}

// Load catalog from storage
async function loadCatalogFromStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("baxusCatalog", (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.baxusCatalog || null);
      }
    });
  });
}

// Initialize catalog on startup
loadCatalogFromStorage().then(catalog => {
  baxusCatalog = catalog ? catalog.bottles : null;
  if (!baxusCatalog) {
    console.log("No catalog in storage, fetching new one");
    updateCatalog();
  }
});

// Set up periodic updates
chrome.alarms.create("refreshCatalog", { periodInMinutes: 1440 }); // 24 hours

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshCatalog") {
    console.log("Alarm triggered, refreshing catalog");
    updateCatalog();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated, fetching catalog");
  updateCatalog();
});

// Normalize bottle names
function normalizeName(name) {
  if (!name) return "";
  const stopWords = [
    'the', 'a', 'an', 'in', 'for', 'of', 'and', 'with', 'on', 'at', 'to', 
    'bottled', 'by', 'from', 'distillery', 'cask', 'barrel', 'aged', 
    'limited', 'edition', 'release', 'collection', 'series', 'blend', 
    'batch', 'single cask'
  ];
  let normalized = name.toLowerCase()
    .replace(/whisky|whiskey|scotch|single malt/gi, '')
    .replace(/[\(\[\{].*?[\)\]\}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  normalized = normalized
    .split(' ')
    .filter(word => !stopWords.includes(word))
    .join(' ');
  return normalized;
}

// Find the best match
function findBestMatch(scrapedName) {
  if (!baxusCatalog) {
    console.log("Catalog not loaded");
    return null;
  }
  const normalizedScrapedName = normalizeName(scrapedName);
  let bestMatch = null;
  let highestScore = 0;
  for (const bottle of baxusCatalog) {
    const normalizedCatalogName = normalizeName(bottle.name);
    const score = fuzzball.ratio(normalizedScrapedName, normalizedCatalogName);
    if (score > highestScore && score >= 75) {
      highestScore = score;
      bestMatch = bottle;
    }
  }
  return bestMatch ? { match: bestMatch, score: highestScore } : null;
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkMatch") {
    const product = message.product;
    if (!product || !product.name || !product.price) {
      console.log("Invalid product data");
      return;
    }
    if (!baxusCatalog) {
      console.log("Catalog not loaded yet");
      return;
    }
    const bestMatch = findBestMatch(product.name);
    if (bestMatch && typeof product.price === "number" && typeof bestMatch.match.price === "number") {
      const savings = product.price - bestMatch.match.price;
      if (savings > 0) {
        console.log(`Savings found: $${savings}, opening popup`);
        chrome.action.openPopup();
      }
    }
  }
});