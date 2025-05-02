import asyncio
import json
import os
import re
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, HttpUrl
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig, CrawlResult
from crawl4ai import LLMExtractionStrategy, LLMConfig
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Bottle Scraper API", description="API to scrape alcohol bottle name and price from a webpage.")

# Pydantic model for request
class ScrapeRequest(BaseModel):
    url: HttpUrl  # Ensures the URL is valid

async def extract_bottle_data(url: str) -> dict:
    """Extract name and price (in USD) of the primary alcohol bottle from a webpage using LLM."""
    # Validate API token
    groq_api_token = os.getenv("GROQ_API_TOKEN", "")
    if not groq_api_token:
        logger.error("GROQ_API_TOKEN is not set.")
        return {"error": "Server configuration error: Missing API token"}

    extraction_strategy = LLMExtractionStrategy(
        llm_config=LLMConfig(
            provider="groq/qwen-qwq-32b",
            api_token=groq_api_token,
            max_tokens=4096,
        ),
        instruction=(
            "Analyze the alcohol product page and extract the name and price of the primary bottle. "
            "Focus on the main product, ignoring related products or recommendations. "
            "If the price is in USD, return it as a number. "
            "If the price is in another currency (e.g., EUR, GBP, CAD, AUD), convert it to USD using approximate exchange rates: "
            "1 EUR = 1.10 USD, 1 GBP = 1.25 USD, 1 CAD = 0.75 USD, 1 AUD = 0.65 USD. "
            "If the currency is unclear, assume USD. "
            "Return a JSON object with 'name' (string, full product name) and 'price' (number, in USD). "
            "Ensure only one bottle's data is returned. "
            "Example: {'name': 'Johnnie Walker Black Label Scotch Whisky 750ml', 'price': 25.87}"
        ),
        extract_type="schema",
        schema="{name: string, price: number}",
        extra_args={
            "temperature": 0.0,
            "max_tokens": 4096,
        },
        verbose=True,
    )

    config = CrawlerRunConfig(extraction_strategy=extraction_strategy)

    async with AsyncWebCrawler(config=BrowserConfig(
        viewport_height=1080,
        viewport_width=1920,
        headless=True,
    )) as crawler:
        try:
            results: list[CrawlResult] = await crawler.arun(url=url, config=config)
            if not results or not results[0].success:
                logger.error(f"Failed to crawl {url}.")
                return {"error": "Failed to crawl the webpage"}

            extracted_content = results[0].extracted_content
            logger.info(f"Extracted content for {url}: {extracted_content}")

            try:
                extracted_data = json.loads(extracted_content)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse extracted content as JSON: {extracted_content}")
                return {"error": "Failed to parse extracted data"}

            if not extracted_data or not isinstance(extracted_data, list) or len(extracted_data) == 0:
                logger.error(f"No valid data extracted for {url}.")
                return {"error": "No valid data extracted"}

            # Find the first block with a valid name and numeric price
            selected_data = None
            max_name_length = 0
            for data in extracted_data:
                if not all(key in data for key in ["name", "price"]):
                    logger.warning(f"Skipping block missing required fields: {data}")
                    continue

                name = str(data.get("name", "")).strip()
                price = data.get("price")

                if not name:
                    logger.warning(f"Skipping block with empty name: {data}")
                    continue
                if price is None or price == "":
                    logger.warning(f"Skipping block with empty price: {data}")
                    continue

                # Ensure price is numeric (float or int)
                try:
                    price_float = float(price)
                    if price_float < 0:
                        logger.warning(f"Skipping block with negative price '{price}': {data}")
                        continue
                except (ValueError, TypeError):
                    logger.warning(f"Skipping block with non-numeric price '{price}': {data}")
                    continue

                # Prefer the block with the longest name (likely more specific)
                if len(name) > max_name_length:
                    max_name_length = len(name)
                    selected_data = data

            if not selected_data:
                logger.error(f"No valid blocks with name and numeric price found for {url}.")
                return {"error": "Failed to extract valid name and price"}

            # Process the selected block
            name = str(selected_data.get("name", "")).strip()
            price = selected_data.get("price")

            logger.info(f"Selected block for {url}: {selected_data}")

            # Ensure name is non-empty
            if not name:
                logger.error(f"Selected block has empty name for {url}.")
                return {"error": "Failed to extract a valid name"}

            # Validate and convert price to float
            try:
                price_float = float(price)
                if price_float < 0:
                    logger.error(f"Negative price '{price_float}' in selected block for {url}.")
                    return {"error": "Invalid price: Negative value"}
            except (ValueError, TypeError):
                logger.error(f"Non-numeric price '{price}' in selected block for {url}.")
                return {"error": "Failed to extract a valid price"}

            # Ensure price is reasonable (e.g., not unrealistically high)
            if price_float > 10000:
                logger.warning(f"Price '{price_float}' seems unusually high for {url}. Assuming USD.")
                return {"error": "Invalid price: Unrealistically high"}

            return {
                "name": name,
                "price": price_float
            }
        except Exception as e:
            logger.error(f"Error extracting data for {url}: {str(e)}")
            return {"error": f"Extraction failed: {str(e)}"}

@app.post("/scrape", response_model=dict)
async def scrape_page(request: ScrapeRequest):
    """API endpoint to scrape a page and return the bottle's name and price in USD."""
    logger.info(f"Received request to scrape {request.url}")
    try:
        result = await extract_bottle_data(str(request.url))
        if "error" in result:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])
        logger.info(f"API response for {request.url}: {result}")
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error processing request for {request.url}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error")

@app.get("/health")
async def health_check():
    """Health check endpoint to verify the server is running."""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)