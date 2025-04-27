# The Honey Barrel Chrome Extension

    A Chrome extension that scrapes whisky/wine bottle information from retail websites and compares prices with BAXUS marketplace.

    ## Installation
    1. Clone this repository
    2. Open Chrome and navigate to chrome://extensions/
    3. Enable "Developer mode"
    4. Click "Load unpacked" and select the extension directory
    5. The extension icon should appear in your toolbar

    ## Features
    - Automatic bottle information scraping
    - Price comparison with BAXUS marketplace
    - Clean popup interface showing savings
    - Direct links to BAXUS listings
    - Fuzzy matching for bottle names
    - Support for multiple retail website formats

    ## Supported Websites
    - General e-commerce sites with standard product layouts
    - Wine/spirits retail sites with common price/name selectors

    ## Technical Details
    - Uses Levenshtein distance for fuzzy matching
    - Implements efficient API calls to BAXUS
    - Follows Chrome Web Store security guidelines
    - Handles various edge cases in bottle naming

    ## Development
    To modify the extension:
    1. Update the content scripts for new website selectors
    2. Adjust the matching algorithm in background.js
    3. Modify popup styling in popup.html
    4. Test thoroughly across different retail sites
