# BAXUS Deals

A Chrome extension that compares a retailer's bottle listing with the BAXUS marketplace and shows a possible match, price difference and marketplace link.

**JavaScript · Chrome Manifest V3 · Python / FastAPI · Crawl4AI**

[Recorded hackathon demo](https://www.loom.com/share/a0faed80516248e8af840ea737596d71) · [Extension](baxus-extension) · [Backend](backend_server/simple_scraper.py)

**Status:** hackathon prototype. The demo is a historical recording, not evidence that current retailer selectors, marketplace APIs or the configured LLM model still work. No automated behavioral test suite or CI is checked in.

## How it works

- A content script reads supported product pages using the selectors in [schemas.json](baxus-extension/schemas.json).
- The [background worker](baxus-extension/background.js) fetches and caches the marketplace catalog in `chrome.storage.local`, with a daily refresh alarm.
- The [popup](baxus-extension/popup.js) normalizes product names, uses Fuzzball similarity to select a candidate and displays the comparison.
- For an unsupported page, the popup can send its URL to a local [FastAPI endpoint](backend_server/simple_scraper.py), which uses Crawl4AI and a server-side LLM to extract a name and price.

## Install the extension

```bash
git clone https://github.com/sahilvermadev/baxus-deal.git
cd baxus-deal
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `baxus-extension/`. The catalog and supported-site extraction paths do not require the local Python server; they do require the external marketplace and site markup to remain compatible.

## Optional extraction backend

Use a Python environment compatible with Crawl4AI:

```bash
cd backend_server
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
crawl4ai-setup
cp .env.example .env
```

Set **`GROQ_API_TOKEN`** in the local `.env`; that is the variable the server actually reads. Then run:

```bash
python simple_scraper.py
```

The extension expects `http://localhost:8000/scrape`; `http://localhost:8000/health` exposes a liveness check. The configured extraction model is `groq/qwen-qwq-32b`; check provider availability before invoking it. Dependencies are unpinned prototype inputs, not a verified reproducible environment. The backend is intended for local demonstration and has no production authentication or URL-fetch isolation.

## Design tradeoffs and known limits

- **Matching:** normalized-name similarity is a heuristic, not proof of the same bottle, vintage, size or edition. The score is not a calibrated probability. Normalization/matching logic is duplicated between background and popup code.
- **Prices:** the fallback asks the model to use fixed approximate currency conversions. Results omit a live FX source, shipping, tax and checkout availability; displayed differences are indicative.
- **Latency:** the fallback launches a browser and sends page material through LLM extraction. The schema-learning experiment was not reliable enough for the hackathon.
- **Permissions:** the current manifest requests access to all sites. Restricting hosts and reducing permissions are follow-up work before wider distribution.
- **Validation:** manual demo evidence exists; automated matching, extraction-failure and browser-integration regressions are future work.

## Code-reading route

| File | Responsibility |
| --- | --- |
| [manifest.json](baxus-extension/manifest.json) | Browser permissions, content script, service worker and popup registration |
| [content.js](baxus-extension/content.js) | Selector-based extraction from the active page |
| [background.js](baxus-extension/background.js) | Catalog download, caching, refresh and message handling |
| [popup.js](baxus-extension/popup.js) | Matching, comparison UI and backend fallback |
| [simple_scraper.py](backend_server/simple_scraper.py) | URL input, LLM extraction and returned-data checks |

The bundled matching library is [Fuzzball](https://github.com/nol13/fuzzball.js); browser-assisted extraction uses [Crawl4AI](https://github.com/unclecode/crawl4ai).
