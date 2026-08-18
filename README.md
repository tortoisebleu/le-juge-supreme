# Le Juge Suprême 🍴⚖️

A Google Apps Script application that automatically records food expenses and calorie information from uploaded receipt images.

The application uses the Gemini API to process receipt information and integrates weather data through an external API.

## Features

### Receipt Processing

Upload a photo of a receipt and the application extracts and records detailed information for each purchased item, including:

- Purchase date
- Store name
- Product name
- Category
- Price
- Amount
- Calorie value
- Notes

Calorie values are either provided by the user or estimated by AI when no user-specified value is available. The basis for AI-based calorie estimation is recorded in the Notes field.

### Weather Data

Weather data for the date of purchase is retrieved via an API and recorded in the Google Sheet.

The following weather information is recorded:

- Temperature
- Feels-like temperature
- Humidity
- Precipitation
- Weather conditions

The weather data corresponds to 12:00 on the date of purchase.

### Application Display

After processing a receipt, the application displays:

- Store name
- Total amount
- Total calories for all items on the receipt
- AI-generated comment

### Monthly Reports

The application provides two buttons:

- **Bilan du mois** — displays the total amount spent during the current month
- **Mois dernier** — displays the total amount spent during the previous month

## Requirements

- A Google account
- A Gemini API key from Google AI Studio
- A Google Spreadsheet with the following sheet names:
  - `家計簿`
  - `設定`
- A Google Drive folder for storing uploaded receipt images

## Setup

1. Set your `GEMINI_API_KEY` in the Google Apps Script Script Properties.
2. Enter your Google Drive folder ID in `SAVE_FOLDER_ID` in `Code.gs`.
3. Adjust `modelName` in `Code.gs` according to your environment.

## Usage

1. Upload a photo of a receipt.
2. Click **"Ouvrir le procès !"**.
3. Review the extracted information and results.

## Technologies

- Google Apps Script (GAS)
- Google Sheets
- Gemini API
- Weather API
- JavaScript
- HTML/CSS
