// Load schemas from schemas.json
let SUPPORTED_SCHEMAS = new Map();

// Load schemas asynchronously
async function loadSchemas() {
  try {
    const url = chrome.runtime.getURL('schemas.json');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch schemas.json: ${response.statusText}`);
    const schemasArray = await response.json();
    SUPPORTED_SCHEMAS = new Map(schemasArray);
    console.log("Schemas loaded:", Array.from(SUPPORTED_SCHEMAS.keys()));
  } catch (error) {
    console.error("Failed to load schemas:", error);
    SUPPORTED_SCHEMAS = new Map(); // Fallback to empty Map
  }
}

// Function to scrape product name and price
async function scrapeProductData() {
  console.log("Scraping product data...");

  // Ensure schemas are loaded before proceeding
  await loadSchemas();

  // Get current domain
  const currentDomain = window.location.hostname;
  console.log("Current domain:", currentDomain);

  // Check if the current website is supported
  const schema = Array.from(SUPPORTED_SCHEMAS.entries()).find(([key]) => 
    currentDomain === key || currentDomain.endsWith(`.${key}`)
  )?.[1];

  if (!schema) {
    console.log("Website not supported:", currentDomain);
    return { name: "Not supported", price: null };
  }

  console.log("Using schema for:", schema.name);

  // Scrape the product name
  const nameElement = document.querySelector(schema.productNameSelector);
  const name = nameElement ? nameElement.textContent.trim() : "Not found";

  // Scrape the price
  let priceElement = document.querySelector(schema.pricePrioritySelector);
  if (!priceElement) {
    priceElement = document.querySelector(schema.fallbackPriceSelector);
  }
  const priceText = priceElement ? priceElement.textContent.trim() : "Not found";
  let price;
  if (priceText !== "Not found") {
    // Remove currency symbols, commas, and other non-numeric characters (keep digits and decimal point)
    const cleanPriceText = priceText.replace(/[^\d.]/g, ''); // Remove everything except digits and decimal point
    price = parseFloat(cleanPriceText);
    price = isNaN(price) ? null : price; // Set to null if conversion fails
  } else {
    price = null;
  }

  const product = { name, price };
  console.log("Scraped product:", product);
  return product;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scrapeProduct") {
    scrapeProductData().then(product => {
      sendResponse({ product });
    });
    return true; // Keep the message channel open for async response
  }
});

// Scrape immediately on page load and retry after 2 seconds for dynamic content
document.addEventListener("DOMContentLoaded", () => {
  scrapeProductData();
});
setTimeout(() => {
  scrapeProductData();
},);