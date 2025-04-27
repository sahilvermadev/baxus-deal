// Global catalog variable
let baxusCatalog = null;

// Load the BAXUS catalog on popup load
async function loadCatalog() {
  try {
    console.log("Starting catalog load...");
    const url = chrome.runtime.getURL('baxus_catalog.json');
    console.log("Fetching catalog from:", url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    baxusCatalog = data.bottles || [];
    console.log("Catalog loaded successfully with", baxusCatalog.length, "bottles");
  } catch (error) {
    console.error("Catalog loading failed:", error.message);
    baxusCatalog = null;
  }
  return baxusCatalog;
}

// Normalize names for better matching
function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/whisky|whiskey|scotch|single malt/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find the best match in the catalog using fuzzball
function findBestMatch(scrapedName) {
  if (!baxusCatalog || !scrapedName) {
    console.log("Cannot match: Catalog or scraped name is missing", { baxusCatalog, scrapedName });
    return null;
  }

  const normalizedScrapedName = normalizeName(scrapedName);
  console.log("Normalized scraped name:", normalizedScrapedName);
  let bestMatch = null;
  let highestScore = 0;

  for (const bottle of baxusCatalog) {
    const normalizedCatalogName = normalizeName(bottle.name);
    const score = fuzzball.ratio(normalizedScrapedName, normalizedCatalogName);
    console.log(`Comparing with ${normalizedCatalogName}: Score ${score}`);
    if (score > highestScore && score >= 80) {
      highestScore = score;
      bestMatch = bottle;
    }
  }

  if (bestMatch) {
    console.log("Best match found:", bestMatch.name, "with score:", highestScore);
  } else {
    console.log("No match found above threshold of 80");
  }
  return { match: bestMatch, score: highestScore };
}

// Display BAXUS match in the UI
function displayBaxusMatch(product, baxusMatchElement, baxusNameElement, baxusPriceElement, priceDifferenceElement, baxusLinkElement, matchQualityElement, unavailableMessageElement) {
  console.log("Attempting to display BAXUS match for:", product.name);
  const { match: bestMatch, score } = findBestMatch(product.name);
  if (bestMatch) {
    // Display match quality
    let qualityClass = '';
    let qualityText = '';
    if (score >= 95) {
      qualityClass = 'high';
      qualityText = 'High Match Confidence';
    } else if (score >= 90) {
      qualityClass = 'medium';
      qualityText = 'Medium Match Confidence';
    } else {
      qualityClass = 'low';
      qualityText = 'Low Match Confidence';
    }
    matchQualityElement.textContent = qualityText;
    matchQualityElement.className = `match-quality ${qualityClass}`;

    baxusNameElement.textContent = bestMatch.name;
    baxusPriceElement.textContent = bestMatch.price !== null ? `$${bestMatch.price.toFixed(2)}` : "Not found";
    
    if (typeof product.price === "number" && typeof bestMatch.price === "number") {
      const diff = product.price - bestMatch.price;
      if (diff > 0) {
        priceDifferenceElement.textContent = `Save $${diff.toFixed(2)} on BAXUS`;
        priceDifferenceElement.classList.add("save");
        priceDifferenceElement.classList.remove("loss", "same");
      } else if (diff < 0) {
        priceDifferenceElement.textContent = `Current site is $${Math.abs(diff).toFixed(2)} cheaper`;
        priceDifferenceElement.classList.add("loss");
        priceDifferenceElement.classList.remove("save", "same");
      } else {
        priceDifferenceElement.textContent = "Prices are the same";
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
    console.log("BAXUS match displayed:", bestMatch.name, "with score:", score);
  } else {
    console.log("No match found, showing unavailable message");
    baxusMatchElement.classList.add("hidden");
    matchQualityElement.classList.add("hidden");
    unavailableMessageElement.textContent = `${product.name} is currently unavailable on BAXUS`;
    unavailableMessageElement.classList.remove("hidden");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup DOM fully loaded, starting initialization...");
  const loadingState = document.getElementById("loading-state");
  
  try {
    // Show loading spinner for supported sites
    loadingState.classList.remove("hidden");

    // Load catalog first
    await loadCatalog();
    if (!baxusCatalog || baxusCatalog.length === 0) {
      console.error("Catalog not loaded or empty, cannot proceed with matching");
      loadingState.classList.add("hidden");
      document.getElementById("baxus-match").classList.add("hidden");
      document.getElementById("unavailable-message").textContent = "Unable to load BAXUS catalog. Please try again later.";
      document.getElementById("unavailable-message").classList.remove("hidden");
      return;
    }

    // Scrape product data
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      console.log("Sending scrape request to tab:", tab.id);
      chrome.tabs.sendMessage(tab.id, { action: "scrapeProduct" }, (response) => {
        console.log("Received response from content script:", response);
        const product = response?.product || { name: "Not supported", price: null };
        console.log("Processed product data:", product);
        updatePopup(product);
        loadingState.classList.add("hidden"); // Hide spinner after updating UI
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

// Update the popup with the scraped data
function updatePopup(product) {
  console.log("Updating popup with product:", product);
  const baxusMatch = document.getElementById("baxus-match");
  const baxusName = document.getElementById("baxus-name");
  const baxusPrice = document.getElementById("baxus-price");
  const priceDifference = document.getElementById("price-difference");
  const baxusLink = document.getElementById("baxus-link");
  const matchQuality = document.getElementById("match-quality");
  const unavailableMessage = document.getElementById("unavailable-message");
  const unsupportedContainer = document.getElementById("unsupported-container");
  const apiResult = document.getElementById("api-result");

  if (product.name === "Not supported") {
    console.log("Displaying unsupported container");
    baxusMatch.classList.add("hidden");
    matchQuality.classList.add("hidden");
    unavailableMessage.classList.add("hidden");
    unsupportedContainer.classList.remove("hidden");
    apiResult.classList.add("hidden");
  } else {
    console.log("Processing supported product for BAXUS match");
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

// Function to check for a better deal via API (for unsupported sites)
async function checkBaxusDeal() {
  const apiResult = document.getElementById("api-result");
  const unsupportedContainer = document.getElementById("unsupported-container");
  const baxusMatch = document.getElementById("baxus-match-api");
  const baxusName = document.getElementById("baxus-name-api");
  const baxusPrice = document.getElementById("baxus-price-api");
  const priceDifference = document.getElementById("price-difference-api");
  const baxusLink = document.getElementById("baxus-link-api");
  const matchQuality = document.getElementById("match-quality-api");
  const loadingState = document.getElementById("loading-state");

  try {
    // Show loading spinner
    loadingState.classList.remove("hidden");
    unsupportedContainer.classList.add("hidden");

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0].url;
    console.log("Checking deal for URL:", url);

    const response = await fetch("http://localhost:8000/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    console.log("API response:", data);

    if (data.error) {
      baxusMatch.classList.add("hidden");
      matchQuality.classList.add("hidden");
    } else {
      displayBaxusMatch(
        data,
        baxusMatch,
        baxusName,
        baxusPrice,
        priceDifference,
        baxusLink,
        matchQuality,
        document.createElement("div") // Placeholder, not used for unsupported sites
      );
    }

    apiResult.classList.remove("hidden");
    loadingState.classList.add("hidden"); // Hide spinner
  } catch (error) {
    console.error("Error in checkBaxusDeal:", error);
    apiResult.classList.remove("hidden");
    baxusMatch.classList.add("hidden");
    matchQuality.classList.add("hidden");
    loadingState.classList.add("hidden"); // Hide spinner
  }
}