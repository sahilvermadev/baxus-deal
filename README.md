# BAXUS DEALS

![GitHub last commit](https://img.shields.io/github/last-commit/sahilvermadev/baxus-deal?style=flat-square) ![GitHub issues](https://img.shields.io/github/issues/sahilvermadev/baxus-deal?style=flat-square)

**BAXUS Deals** is a Chrome extension crafted for wine and whisky enthusiasts 🍷🥃 to discover the best deals on the BAXUS marketplace. It scrapes bottle information from third-party e-commerce and retail websites, compares it with the BAXUS marketplace, and highlights potential savings. If a better deal is found on BAXUS, the extension provides direct links to the listing, making your shopping experience seamless and cost-effective.

---

## 📑 Table of Contents

- [Project Structure](#project-structure)
- [Installation](#installation)
  - [Setting Up the Backend Server](#setting-up-the-backend-server)
  - [Installing the Chrome Extension](#installing-the-chrome-extension)
- [Usage](#usage)
- [Features](#features)
- [Supported Websites](#supported-websites)
- [Technologies Used](#technologies-used)
- [How It Works](#how-it-works)
- [Development Setup](#development-setup)
- [Demo](#demo)
- [Areas of Improvement and Future Features](#areas-of-improvement-and-future-features)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgments](#acknowledgments)

---

## 🗂️ Project Structure

The project is divided into two main directories:

- **backend_server/**: Handles server-side logic for scraping unsupported websites.
  - `simple_scraper.py`: Core scraping script using Crawl4AI.
  - `.env`: Environment variables (e.g., API keys).
  - `requirements.txt`: Lists Python dependencies for the backend.
- **baxus-extension/**: Contains the Chrome extension files.
  - `background.js`: Manages catalog fetching and matching.
  - `content.js`: Scrapes supported websites.
  - `fuzzball.umd.min.js`: Library for fuzzy matching of bottle names.
  - `manifest.json`: Chrome extension manifest file.
  - `popup.css`: Styles for the extension popup.
  - `popup.html`: HTML for the extension popup.
  - `popup.js`: Logic for the popup UI and interaction.
  - `schemas.json`: Defines scraping schemas for supported websites.
  - `icons/`: Directory containing extension icons.

---

## 🛠️ Installation

### Setting Up the Backend Server

The backend server is essential for scraping unsupported websites via an API.

1. **Clone the Repository**  
   ```bash
   git clone https://github.com/sahilvermadev/baxus-deal.git
   ```
2. **Navigate to the Backend Directory**  
   ```bash
   cd baxus-deal/backend_server
   ```
3. **Create a Virtual Environment**  
   ```bash
   python3 -m venv venv
   ```
4. **Activate the Virtual Environment**  
   - On Unix/Linux/MacOS:  
     ```bash
     source venv/bin/activate
     ```
   - On Windows:  
     ```bash
     .\venv\Scripts\activate
     ```
5. **Install Dependencies**  
   ```bash
   pip install crawl4ai fastapi uvicorn
   ```
6. **Run Crawl4AI Setup**  
   Install Playwright browsers and initialize the database:  
   ```bash
   crawl4ai-setup
   ```
7. **Add the API Key**  
   Add your Grok API key to the `.env` file in the `backend_server` directory. Create the file if it doesn’t exist, and add:  
   ```plaintext
   GROK_API_KEY=your-api-key-here
   ```
   Replace `your-api-key-here` with your actual API key.
8. **Start the Server**  
   Run the `simple_scraper.py` script:  
   ```bash
   python simple_scraper.py
   ```
   The server will be available at `http://localhost:8000`.

### Installing the Chrome Extension

> **Note**: This section assumes you’ve already cloned the repository as part of setting up the backend server. If not, follow the cloning step in [Setting Up the Backend Server](#setting-up-the-backend-server).

1. **Open Chrome Extensions Page**  
   Go to `chrome://extensions/`.
2. **Enable Developer Mode**  
   Toggle "Developer Mode" in the top right corner.
3. **Load the Extension**  
   Click **Load unpacked** and select the `baxus-deal/baxus-extension` directory.

---

## 🚀 Usage

1. Ensure the backend server is running (see [Setting Up the Backend Server](#setting-up-the-backend-server)).
2. Visit a supported e-commerce or retail website.
3. Click the BAXUS Deals extension icon in the Chrome toolbar.
4. Check the comparison results for better deals on the BAXUS marketplace.
5. For unsupported websites, click the "Check BAXUS Deal" button in the popup to scrape via the backend server.

---

## ✨ Features

- 🔍 Scrapes bottle name and price from supported retail websites.
- 🧠 Matches scraped data with BAXUS listings using fuzzy matching.
- 💰 Displays price comparisons and potential savings.
- 🔗 Provides direct links to BAXUS for better deals.
- 🌐 Backend server support for scraping unsupported websites.

---

## 🌍 Supported Websites

The extension supports the following websites, as defined in `schemas.json`:

- [Flask Fine Wines](https://flaskfinewines.com)
- [Wine-Searcher](https://wine-searcher.com)
- [Total Wine](https://totalwine.com)
- [MGM Run](https://mgmrun.com)
- [Wine.com](https://wine.com)
- [Dan Murphy's](https://danmurphys.com.au)
- [Master of Malt](https://masterofmalt.com)
- [Cana Wine Company](https://canawineco.com)
- [Cask Cartel](https://caskcartel.com)
- [Whisky Online](https://whisky-online.com)
- [Spirits of France](https://spiritsoffrance.com.au)
- [The Rare Whiskey Shop](https://therarewhiskeyshop.com)
- [Lochs of Whisky](https://lochsofwhisky.com)
- [The Whisky Exchange](https://thewhiskyexchange.com)

---

## 🛠️ Technologies Used

| Technology        | Purpose                          |
|-------------------|----------------------------------|
| **Chrome Extension APIs** | Browser integration and functionality |
| **JavaScript**    | Core scripting for the extension |
| **Fuzzball.js**   | Fuzzy matching for bottle names |
| **BAXUS API**     | Fetches catalog data for comparisons |
| **Python/FastAPI**| Backend server for scraping |
| **Crawl4AI**      | Web scraping library for the backend |
| **Playwright**    | Browser automation for scraping |

---

## ⚙️ How It Works

1. **Supported Sites**: Uses predefined schemas (`schemas.json`) to scrape bottle names and prices directly in the browser.
2. **Unsupported Sites**: Sends a request to the backend server, which uses Crawl4AI to scrape the page.
3. **Catalog Fetching**: Fetches the BAXUS catalog via API on startup and stores it in `chrome.storage.local`.
4. **Matching**: Normalizes the scraped bottle name and matches it against the BAXUS catalog using fuzzy matching.
5. **Price Comparison**: Displays savings and a link to the BAXUS listing if a better price is found.

---

## 💻 Development Setup

To contribute to the project:

1. **Clone the Repository**  
   ```bash
   git clone https://github.com/sahilvermadev/baxus-deal.git
   ```
2. **Set Up the Backend Server**  
   Follow the steps in [Setting Up the Backend Server](#setting-up-the-backend-server).
3. **Modify Extension Files**  
   Make changes in `baxus-extension/` and reload the extension in Chrome via `chrome://extensions/`.

---

## 🎥 Demo

<div>
    <a href="https://www.loom.com/share/a0faed80516248e8af840ea737596d71">
      <p>Baxithon Extension Demo - Watch Video</p>
    </a>
    <a href="https://www.loom.com/share/a0faed80516248e8af840ea737596d71">
      <img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/a0faed80516248e8af840ea737596d71-c620ee293c90ecd9-full-play.gif">
    </a>
  </div>

---

## 🚀 Areas of Improvement and Future Features

### Areas of Improvement

1. **Reducing Scraping Time for Unsupported Websites**  
   Currently, Crawl4AI takes significant time to set up a headless browser, and the LLM used for parsing the HTML of the entire page adds further latency. Optimizing this process—potentially by caching browser instances or using lighter scraping methods—could significantly improve performance.

### Experimentation

1. **Self-Learning Extension for Schemas**  
   An experimental feature was explored to make the extension self-learning. The idea was to use an LLM to dynamically determine the correct schema for unsupported websites during the first visit. If successful, the schema would be saved for future use, reducing LLM costs and latency. However, this feature was not reliable enough for the hackathon due to:  
   - **Issue 1**: The massive HTML size of most websites overwhelmed the LLM, leading to inconsistent schema detection.  
   - **Issue 2**: The initial run was extremely slow due to the added latency of LLM processing, making the user experience impractical.

### Future Features

1. **Wishlist Feature**  
   A wishlist functionality could be added, allowing users to input the name of a bottle they’re looking for that isn’t currently available on BAXUS. The extension would then monitor the BAXUS catalog and notify the user (via a popup or notification) when the bottle becomes available.

---

## 🤝 Contributing

Contributions are welcome! To get involved:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Submit a pull request with a clear description of your changes.
4. Ensure your code follows the project’s coding standards.

For bug reports or feature requests, please open an issue on GitHub.

---

## 📬 Contact

For questions, suggestions, or issues:

- Open an issue on [GitHub](https://github.com/sahilvermadev/baxus-deal/issues).
- Email: [sahilvermadev@gmail.com]

---

## 🙏 Acknowledgments

- Thanks to the creators of [Fuzzball.js](https://github.com/nol13/fuzzball.js) for their excellent fuzzy matching library.
- Thanks to the [Crawl4AI](https://github.com/crawl4ai/crawl4ai) team for their web scraping framework.

---