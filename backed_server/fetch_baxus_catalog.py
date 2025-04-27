import requests
import json
from datetime import datetime
import time

# Configuration
CATALOG_FILE = "baxus_catalog.json"
BAXUS_API_URL = "https://services.baxus.co/api/search/listings"
PAGE_SIZE = 1000  # Increased to fetch more bottles per request
REQUEST_DELAY = 0.5  # Reduced delay between requests (seconds)
MAX_RETRIES = 3  # Number of retries for rate-limited requests

def fetch_baxus_catalog():
    """Fetch the entire BAXUS catalog and return a list of bottles."""
    bottles = []
    from_idx = 0

    while True:
        url = f"{BAXUS_API_URL}?from={from_idx}&size={PAGE_SIZE}&listed=true"
        retries = 0
        while retries < MAX_RETRIES:
            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                data = response.json()

                if not data:  # No more data to fetch
                    print("No more listings to fetch.")
                    return bottles

                # Extract relevant bottle details, including _id, with fallbacks for missing fields
                for listing in data:
                    bottle = listing["_source"]
                    attributes = bottle.get("attributes", {})
                    simplified_bottle = {
                        "id": bottle.get("id", ""),
                        "name": bottle.get("name", ""),
                        "price": bottle.get("price", 0),
                        "producer": attributes.get("Producer", ""),
                        "yearBottled": attributes.get("Year Bottled", ""),
                        "abv": attributes.get("ABV", ""),
                        "imageUrl": bottle.get("imageUrl", "")
                    }
                    bottles.append(simplified_bottle)

                from_idx += PAGE_SIZE
                print(f"Fetched {len(bottles)} bottles so far...")

                # Throttle requests to avoid rate limiting
                time.sleep(REQUEST_DELAY)
                break  # Exit retry loop on success

            except requests.exceptions.HTTPError as e:
                if response.status_code == 429:  # Rate limiting
                    retries += 1
                    wait_time = 2 ** retries  # Exponential backoff: 2s, 4s, 8s
                    print(f"Rate limited. Retrying ({retries}/{MAX_RETRIES}) after {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    print(f"Error fetching data: {e}")
                    return bottles
            except requests.exceptions.RequestException as e:
                print(f"Error fetching data: {e}")
                return bottles

        if retries >= MAX_RETRIES:
            print("Max retries reached. Stopping fetch.")
            break

    return bottles

def save_catalog(bottles):
    """Save the catalog to a JSON file with a timestamp."""
    catalog = {
        "last_updated": datetime.utcnow().isoformat(),
        "total_bottles": len(bottles),
        "bottles": bottles
    }
    with open(CATALOG_FILE, "w") as f:
        json.dump(catalog, f, indent=2)
    print(f"Saved {len(bottles)} bottles to {CATALOG_FILE}")

def main():
    """Main function to fetch and save the BAXUS catalog."""
    print("Starting BAXUS catalog fetch...")
    bottles = fetch_baxus_catalog()
    if bottles:
        save_catalog(bottles)
    else:
        print("No bottles fetched. Catalog not updated.")

if __name__ == "__main__":
    main()