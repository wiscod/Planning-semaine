# Planning Semaine WhatsApp

Automated script to fetch your school schedule from HyperPlanning and send it via WhatsApp every day.

## Features

- Fetches schedule from HyperPlanning using ICS file (priority) or web scraping (fallback)
- Sends formatted schedule via Twilio WhatsApp
- Runs automatically on GitHub Actions (5:00 AM and 9:00 PM daily)
- Dynamic week detection (current week + next week)
- UTC+2 timezone correction for French time

## Setup Instructions

### 1. Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following 7 secrets:

| Secret Name | Description |
|---|---|
| `HYPERPLANNING_USERNAME` | Your HyperPlanning username |
| `HYPERPLANNING_PASSWORD` | Your HyperPlanning password |
| `ICS_URL` | ICS calendar download URL from HyperPlanning |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp sandbox number |
| `WHATSAPP_TO` | Your WhatsApp phone number |

### 2. Verify Workflow

- Go to **Actions** tab in your GitHub repository
- Click **Send Planning WhatsApp**
- Click **Run workflow** to test manually
- Check the logs to verify it's working

## Schedule

The workflow runs automatically at:
- **5:00 AM UTC** (7:00 AM CEST)
- **9:00 PM UTC** (11:00 PM CEST)

## Manual Trigger

You can manually run the workflow from GitHub UI:
1. Go to **Actions** tab
2. Select **Send Planning WhatsApp**
3. Click **Run workflow**
