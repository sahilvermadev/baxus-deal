// Import fuzzball as an ES module
import * as fuzzball from './fuzzball.esm.min.js';

// Store for product data and alternatives
let currentProductData = null;
let baxusAlternatives = [];
let baxusCatalog = null;

// Load the BAXUS catalog on startup
fetch(chrome.runtime.getURL("baxus_catalog.json"))
  .then((response) => response.json())
  .then((data) => {
    baxusCatalog = data;
    console.log("BAXUS catalog loaded:", baxusCatalog.total_bottles, "bottles");
  })
  .catch((error) => {
    console.error("Error loading BAXUS catalog:", error);
  });

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "productDetected") {
    // Store the product data
    currentProductData = message.product;

    // Find alternatives in the BAXUS catalog
    findBaxusAlternatives(currentProductData)
      .then((alternatives) => {
        baxusAlternatives = alternatives;

        // Update the extension icon to show we found matches
        if (alternatives && alternatives.length > 0) {
          updateExtensionBadge(alternatives.length.toString(), "#4caf50");
        } else {
          updateExtensionBadge("0", "#f44336");
        }
      })
      .catch((error) => {
        console.error("Error finding alternatives:", error);
        updateExtensionBadge("!", "#f44336");
      });

    sendResponse({ status: "received" });
    return true;
  }

  if (message.action === "getProductData") {
    // Return the current product data and alternatives
    sendResponse({
      product: currentProductData,
      alternatives: baxusAlternatives,
      status: baxusAlternatives.length > 0 ? "matches-found" : "no-matches",
    });
    return true;
  }

  if (message.action === "findAlternatives") {
    // Find alternatives for a specific product
    findBaxusAlternatives(message.product)
      .then((alternatives) => {
        baxusAlternatives = alternatives;
        sendResponse({ alternatives: alternatives });
      })
      .catch((error) => {
        console.error("Error finding alternatives:", error);
        sendResponse({ error: error.message });
      });

    return true;
  }
});

// Update the extension badge
function updateExtensionBadge(text, color) {
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: color });
}

// Find alternatives in the BAXUS catalog
async function findBaxusAlternatives(product) {
  if (!product || !product.name || !baxusCatalog) {
    return [];
  }

  try {
    // Process and filter the catalog
    const alternatives = processSearchResults(baxusCatalog, product);
    return alternatives;
  } catch (error) {
    console.error("Error processing BAXUS catalog:", error);
    return [];
  }
}

// Process and filter search results
function processSearchResults(catalog, originalProduct) {
  if (!catalog || !catalog.bottles || catalog.bottles.length === 0) {
    return [];
  }

  // Extract the bottle listings from the catalog
  const listings = catalog.bottles.map((bottle) => {
    return {
      id: bottle.id,
      name: bottle.name || "Unknown Bottle",
      details: `${bottle.producer || ""} ${bottle.yearBottled || ""} ${bottle.abv || ""}% ABV`.trim(),
      price: bottle.price || 0,
      url: `https://baxus.co/marketplace/asset/${bottle.id}`,
      imageUrl: bottle.imageUrl || "",
      matchScore: calculateMatchScore(bottle, originalProduct),
    };
  });

  // Filter out listings that are not a good match (threshold adjusted for fuzzball)
  const filteredListings = listings.filter((listing) => listing.matchScore > 60);

  // Sort by price (lowest first)
  return filteredListings.sort((a, b) => a.price - b.price);
}

// Calculate a match score between the original product and a BAXUS listing
function calculateMatchScore(baxusListing, originalProduct) {
  if (!baxusListing || !originalProduct) return 0;

  const originalName = normalizeProductName(originalProduct.name);
  const baxusName = normalizeProductName(baxusListing.name);

  // Use fuzzball's partial_ratio for fuzzy matching (0-100 scale)
  const nameScore = fuzzball.partial_ratio(originalName, baxusName) / 100;

  // Boost score if producer matches
  let totalScore = nameScore;
  let boost = 0;
  if (baxusListing.producer && originalProduct.name.toLowerCase().includes(baxusListing.producer.toLowerCase())) {
    boost += 0.1;
  }

  // Boost score if yearBottled matches
  if (baxusListing.yearBottled && originalProduct.name.includes(baxusListing.yearBottled)) {
    boost += 0.1;
  }

  // Apply boost but cap at 1.0
  totalScore = Math.min(totalScore + boost, 1.0);

  // Convert to 0-100 scale for consistency with fuzzball
  return totalScore * 100;
}

// Normalize product name for better matching
function normalizeProductName(name) {
  if (!name) return "";

  // Convert to lowercase
  let normalized = name.toLowerCase();

  // Remove common terms that don't help with matching
  const termsToRemove = [
    "limited edition",
    "special release",
    "single malt",
    "blended",
    "scotch",
    "whisky",
    "whiskey",
    "bourbon",
    "wine",
    "red wine",
    "white wine",
    "ml",
    "cl",
    "liter",
    "bottle",
    "750ml",
    "700ml",
    "1l",
  ];

  for (const term of termsToRemove) {
    normalized = normalized.replace(new RegExp("\\b" + term + "\\b", "gi"), "");
  }

  // Remove special characters and extra spaces
  normalized = normalized
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

// Reset data when navigating to a new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    // Clear the current product data when navigating to a new page
    currentProductData = null;
    baxusAlternatives = [];
    updateExtensionBadge("", "#ffffff00");
  }
});