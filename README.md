# Sysco Product Scraper

Web scraper for extracting product data from sysco.com

## Quick Start

```bash
npm install
cp .env.example .env
npm run setup
npm run scrape
```

## Scripts

- `npm run scrape` - Run the scraper
- `npm run setup` - Initialize database
- `npm run export` - Export to CSV
- `npm run dev` - Run with visible browser

## Output

- Database: `data/sysco.db`
- CSV export: `data/sysco_products_full_YYYY-MM-DD.csv`
- Logs: `logs/` directory
