// Global catalog variable
let baxusCatalog = null;

// Load the BAXUS catalog from storage
async function loadCatalog() {
  try {
    console.log("Loading catalog from storage...");
    return new Promise((resolve, reject) => {
      chrome.storage.local.get("baxusCatalog", (result) => {
        if (chrome.runtime.lastError) {
          console.error("Storage error:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          const catalog = result.baxusCatalog || null;
          baxusCatalog = catalog ? catalog.bottles : null;
          console.log("Catalog loaded with", baxusCatalog ? baxusCatalog.length : 0, "bottles");
          resolve(baxusCatalog);
        }
      });
    });
  } catch (error) {
    console.error("Catalog loading failed:", error);
    baxusCatalog = null;
    return null;
  }
}

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

function findBestMatch(scrapedName) {
  if (!baxusCatalog || !scrapedName) {
    console.log("Cannot match: Catalog or scraped name is missing", { baxusCatalog, scrapedName });
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
  return { match: bestMatch, score: highestScore };
}

function displayBaxusMatch(product, baxusMatchElement, baxusNameElement, baxusPriceElement, priceDifferenceElement, baxusLinkElement, matchQualityElement, unavailableMessageElement) {
  const { match: bestMatch, score } = findBestMatch(product.name);
  if (bestMatch) {
    let qualityClass = score >= 95 ? 'high' : score >= 90 ? 'medium' : 'low';
    let qualityText = score >= 95 ? 'High Match Confidence' : score >= 90 ? 'Medium Match Confidence' : 'Low Match Confidence';
    matchQualityElement.textContent = qualityText;
    matchQualityElement.className = `match-quality ${qualityClass}`;

    baxusNameElement.textContent = bestMatch.name;
    baxusPriceElement.textContent = bestMatch.price !== null ? `$${bestMatch.price.toFixed(2)}` : "Not found";
    
    if (typeof product.price === "number" && typeof bestMatch.price === "number") {
      const diff = product.price - bestMatch.price;
      if (diff > 0) {
        priceDifferenceElement.innerHTML = `<span class="save">Save:</span><span id="price-difference">$${diff.toFixed(2)}</span>`;
        priceDifferenceElement.classList.add("save");
        priceDifferenceElement.classList.remove("loss", "same");
      } else if (diff < 0) {
        priceDifferenceElement.classList.add("loss");
        priceDifferenceElement.classList.remove("save", "same");
      } else {
        priceDifferenceElement.classList.add("same");
        priceDifferenceElement.classList.remove("save", "loss");
      }
    } else {
      priceDifferenceElement.textContent = "Unable to compare prices";
      priceDifferenceElement.classList.remove("save", "loss", "same");
    }

    baxusLinkElement.href = `https://baxus.co/asset/${bestMatch.id}`;
    baxusMatchElement.classList.remove("hidden");
    unavailableMessageElement.classList.add("hidden");
  } else if (product.name && product.name !== "Not supported" && product.name !== "Not found") {
    unavailableMessageElement.textContent = `${product.name} is currently unavailable on BAXUS`;
    unavailableMessageElement.classList.remove("hidden");
    baxusMatchElement.classList.add("hidden");
    matchQualityElement.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const loadingState = document.getElementById("loading-state");
  try {
    loadingState.classList.remove("hidden");
    await loadCatalog();
    if (!baxusCatalog || baxusCatalog.length === 0) {
      console.error("Catalog not loaded or empty");
      loadingState.classList.add("hidden");
      document.getElementById("baxus-match").classList.add("hidden");
      document.getElementById("unavailable-message").textContent = "Unable to load BAXUS catalog. Please try again later.";
      document.getElementById("unavailable-message").classList.remove("hidden");
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "scrapeProduct" }, (response) => {
        const product = response?.product || { name: "Not supported", price: null };
        updatePopup(product);
        loadingState.classList.add("hidden");
      });
    });
  } catch (error) {
    console.error("Initialization error:", error);
    loadingState.classList.add("hidden");
    document.getElementById("baxus-match").classList.add("hidden");
    document.getElementById("unavailable-message").textContent = "An error occurred. Please try again later.";
    document.getElementById("unavailable-message").classList.remove("hidden");
  }
  document.getElementById("check-baxus-btn").addEventListener("click", checkBaxusDeal);
});

function updatePopup(product) {
  const baxusMatch = document.getElementById("baxus-match");
  const baxusName = document.getElementById("baxus-name");
  const baxusPrice = document.getElementById("baxus-price");
  const priceDifference = document.getElementById("price-difference");
  const baxusLink = document.getElementById("baxus-link");
  const matchQuality = document.getElementById("match-quality");
  const unavailableMessage = document.getElementById("unavailable-message");
  const unsupportedContainer = document.getElementById("unsupported-container");
  const apiResult = document.getElementById("api-result");

  if (product.name === "Not supported" || product.name === "Not found") {
    baxusMatch.classList.add("hidden");
    matchQuality.classList.add("hidden");
    unavailableMessage.classList.add("hidden");
    unsupportedContainer.classList.remove("hidden");
    apiResult.classList.add("hidden");
    if (product.name === "Not found") {
      unavailableMessage.textContent = "Sorry could not detect the name of the bottle";
      unavailableMessage.classList.remove("hidden");
    }
  } else {
    unsupportedContainer.classList.add("hidden");
    apiResult.classList.add("hidden");
    displayBaxusMatch(
      product,
      baxusMatch,
      baxusName,
      baxusPrice,
      priceDifference,
      baxusLink,
      matchQuality,
      unavailableMessage
    );
  }
}

async function checkBaxusDeal() {
  const apiResult = document.getElementById("api-result");
  const unsupportedContainer = document.getElementById("unsupported-container");
  const baxusMatch = document.getElementById("baxus-match-api");
  const baxusName = document.getElementById("baxus-name-api");
  const baxusPrice = document.getElementById("baxus-price-api");
  const priceDifference = document.getElementById("price-difference-api");
  const baxusLink = document.getElementById("baxus-link-api");
  const matchQuality = document.getElementById("match-quality-api");
  const unavailableMessage = document.getElementById("unavailable-message");
  const loadingState = document.getElementById("loading-state");

  try {
    loadingState.classList.remove("hidden");
    unsupportedContainer.classList.add("hidden");
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;
    const response = await fetch("http://localhost:8000/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 400) {
        baxusMatch.classList.add("hidden");
        matchQuality.classList.add("hidden");
        unavailableMessage.textContent = "Sorry could not detect the name of the bottle";
        unavailableMessage.classList.remove("hidden");
      } else if (response.status === 500) {
        baxusMatch.classList.add("hidden");
        matchQuality.classList.add("hidden");
        unavailableMessage.textContent = "Internal server error, please try again later";
        unavailableMessage.classList.remove("hidden");
      }
    } else {
      const data = await response.json();
      if (!data.name || data.name === "Not found") {
        baxusMatch.classList.add("hidden");
        matchQuality.classList.add("hidden");
        unavailableMessage.textContent = "Sorry could not detect the name of the bottle";
        unavailableMessage.classList.remove("hidden");
      } else {
        displayBaxusMatch(
          data,
          baxusMatch,
          baxusName,
          baxusPrice,
          priceDifference,
          baxusLink,
          matchQuality,
          unavailableMessage
        );
      }
    }
    apiResult.classList.remove("hidden");
    loadingState.classList.add("hidden");
  } catch (error) {
    console.error("Error in checkBaxusDeal:", error);
    apiResult.classList.remove("hidden");
    baxusMatch.classList.add("hidden");
    matchQuality.classList.add("hidden");
    unavailableMessage.textContent = "An error occurred, please try again later";
    unavailableMessage.classList.remove("hidden");
    loadingState.classList.add("hidden");
  }
}