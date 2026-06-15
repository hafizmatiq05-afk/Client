# Shopify AI Dynamic Pricing Assistant

An embedded Shopify admin app that uses Google Gemini AI to recommend dynamic prices based on inventory levels, with merchant-defined rules and constraints.

## Features

- **Automated Pricing Recommendations**: Uses Google Gemini to analyze products and suggest optimal prices when inventory is low
- **Configurable Rules**:
  - Inventory threshold (only apply pricing to low-stock items)
  - Maximum price increase cap (percentage-based, never decrease prices)
  - Never decrease prices (conservative approach)
  - Graceful AI response handling (skip malformed responses)
- **Flexible Scheduling**: Hourly, daily, weekly, or monthly automation cycles
- **Manual Testing**: Run pricing checks on-demand from the dashboard
- **Price History Tracking**: Full audit log of all price changes with AI reasoning
- **Professional Dashboard**: Real-time recommendations, statistics, and historical data
- **Settings Management**: Merchant-friendly configuration page with live examples

## Tech Stack

- **Frontend**: Remix + React + TypeScript + Shopify Polaris
- **Backend**: Remix Server + Node.js
- **Database**: Prisma ORM with SQLite (dev) / PostgreSQL (production)
- **AI**: Google Gemini 2.0 Flash API
- **Scheduling**: node-cron
- **Shopify Integration**: Admin GraphQL API

## Setup

### Prerequisites

- Node.js 18+
- Shopify CLI v3+
- A Shopify Partner account with a development store

### Installation

1. **Clone and install**:
   ```bash
   git clone https://github.com/nimkohungercrunch-dotcom/AI-WEBSITE.git
   cd AI-WEBSITE
   npm install
   ```

2. **Set up environment variables** (copy `.env.example` to `.env`):
   ```bash
   cp .env.example .env
   ```
   Fill in your Shopify API credentials and Gemini API key.

3. **Initialize the database**:
   ```bash
   npm run prisma:migrate
   ```

4. **Get a Gemini API key**:
   - Visit [https://ai.google.dev/gemini-api/docs/quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
   - Create a free API key and add it to `.env`

5. **Run the app**:
   ```bash
   npm run dev
   ```

The Shopify CLI will provide a tunnel URL and load the app into your dev store's admin.

## How It Works

### Settings Page (`/app/settings`)

Configure automation behavior:

- **Inventory Threshold**: Pricing automation only applies to variants with stock at or below this number (default: 50)
- **Maximum Price Increase**: Cap on how much prices can increase as a percentage (default: 50%, e.g., $100 item → max $150)
- **Review Frequency**: How often the AI pricing cycle runs:
  - `Hourly` - top of every hour
  - `Daily` - 3 AM UTC
  - `Weekly` - Monday 3 AM UTC
  - `Monthly` - 1st of month 3 AM UTC
- **AI Behavior Prompt**: Custom merchant instructions for Gemini (e.g., "Be aggressive for premium products, conservative for budget items")

### Dashboard (`/app`)

View real-time recommendations and historical changes:

1. **Summary Cards**:
   - Products Monitored: Count of variants currently at or below your threshold
   - Updated Last Cycle: Number of prices changed in the most recent run
   - Avg. Price Change: Average percentage change across updates

2. **Live Recommendations Tab**:
   - See all products that qualify for repricing
   - View current and recommended prices with delta indicators
   - See the AI's reasoning for each recommendation
   - Status badges show if price was applied, capped at max, or unchanged

3. **Price History Tab**:
   - Complete audit log of all price changes
   - Includes old price, new price, inventory at time of change, and AI reason
   - Sortable and paginated for easy review

4. **Manual Run**:
   - Click "Run pricing check now" to trigger an immediate cycle for testing

## Validation Rules

The pricing engine enforces these rules (failures are graceful, no crashes):

1. **Never exceed max price cap**: If AI recommends above `currentPrice × (1 + maxPriceIncreasePercent ÷ 100)`, clamp to that cap
2. **Never decrease prices**: If AI recommends below current price, skip that variant
3. **Inventory threshold filter**: Only process variants where inventory ≤ merchant's threshold
4. **Malformed AI responses**: If Gemini response can't be parsed or is invalid, skip and log (don't crash)

## File Structure

```
app/
├── services/
│   ├── shopify.server.ts       # Shopify Admin API queries
│   ├── gemini.server.ts        # Google Gemini integration
│   └── pricing.server.ts       # Pricing engine with all rules
├── jobs/
│   └── scheduler.server.ts     # node-cron job registration
├── routes/
│   ├── app._index.tsx          # Dashboard
│   └── app.settings.tsx        # Settings page
prisma/
└── schema.prisma               # Data models
```

## Environment Variables

See `.env.example` for all required variables:

- `SHOPIFY_API_KEY` - Your app's API key from Partner Dashboard
- `SHOPIFY_API_SECRET` - Your app's API secret
- `SHOPIFY_APP_URL` - The app's URL (set by Shopify CLI)
- `SCOPES` - Required Shopify API scopes
- `GEMINI_API_KEY` - Your Google Gemini API key
- `DATABASE_URL` - SQLite path for dev, PostgreSQL for production

## Development

### Database Migrations

After modifying `prisma/schema.prisma`, run:

```bash
npm run prisma:migrate
```

### Regenerate Prisma Client

```bash
npm run prisma:generate
```

## Deployment

When ready to deploy:

```bash
npm run build
npm run deploy
```

The Shopify CLI handles creating the app listing and configuration.

## License

MIT
