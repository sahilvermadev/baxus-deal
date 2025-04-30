importScripts(chrome.runtime.getURL('fuzzball.umd.min.js'));

let baxusCatalog = null;

// Function to normalize bottle names
function normalizeName(name) {
  if (!name) return "";
  console.log("Normalizing name:", name);
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
  console.log("Normalized result:", normalized);
  return normalized;
}

// Function to load the BAXUS catalog
async function loadCatalog() {
  if (baxusCatalog) {
    console.log("Catalog already loaded, returning cached version");
    return baxusCatalog;
  }
  try {
    console.log("Loading catalog from baxus_catalog.json");
    const url = chrome.runtime.getURL('baxus_catalog.json');
    console.log("Catalog URL:", url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    baxusCatalog = data.bottles || [];
    console.log("Catalog loaded successfully, number of bottles:", baxusCatalog.length);
    return baxusCatalog;
  } catch (error) {
    console.error("Failed to load catalog:", error);
    return [];
  }
}

// Function to find the best match
function findBestMatch(scrapedName) {
  console.log("Finding best match for scraped name:", scrapedName);
  if (!baxusCatalog) {
    console.log("No catalog available, returning null");
    return null;
  }
  const normalizedScrapedName = normalizeName(scrapedName);
  let bestMatch = null;
  let highestScore = 0;
  for (const bottle of baxusCatalog) {
    const normalizedCatalogName = normalizeName(bottle.name);
    const score = fuzzball.ratio(normalizedScrapedName, normalizedCatalogName);
    console.log(`Comparing '${normalizedScrapedName}' with '${normalizedCatalogName}', Score: ${score}`);
    if (score > highestScore && score >= 75) {
      highestScore = score;
      bestMatch = bottle;
    }
  }
  if (bestMatch) {
    console.log("Best match found:", bestMatch.name, "Score:", highestScore);
  } else {
    console.log("No match found with score >= 75");
  }
  return bestMatch ? { match: bestMatch, score: highestScore } : null;
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message from content script:", message);
  if (message.action === "checkMatch") {
    const product = message.product;
    console.log("Processing product:", product);
    if (!product || !product.name || !product.price) {
      console.log("Invalid product data, skipping match check");
      return;
    }
    loadCatalog().then(() => {
      const bestMatch = findBestMatch(product.name);
      if (bestMatch) {
        console.log("Match found:", bestMatch.match.name, "Score:", bestMatch.score);
        if (typeof product.price === "number" && typeof bestMatch.match.price === "number") {
          const savings = product.price - bestMatch.match.price;
          console.log(`Price comparison - Scraped: $${product.price}, BAXUS: $${bestMatch.match.price}, Savings: $${savings}`);
          if (savings > 0) {
            console.log("Cost-saving deal found, opening popup. Savings: $", savings);
            chrome.action.openPopup();
          } else {
            console.log("No cost-saving deal (savings <= 0)");
          }
        } else {
          console.log("Invalid price data - Scraped price:", product.price, "BAXUS price:", bestMatch.match.price);
        }
      } else {
        console.log("No match found for product:", product.name);
      }
    });
  }
});