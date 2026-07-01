# Hours Tracker App

This is a simple static hours-tracking web app designed for this setup:

- **GitHub Pages** hosts the app files.
- **Google Sheets** stores the submitted hours.
- **Google Apps Script** acts as the lightweight backend.
- **Squarespace** displays the app using an iframe/code block.

## Files

- `index.html` - app page
- `styles.css` - styling
- `app.js` - app behavior
- `config.js` - your Google Apps Script URL and token
- `google-apps-script/Code.gs` - paste this into Google Apps Script

## Step 1: Create the Google Sheet

1. Create a new Google Sheet.
2. Name it something like `Hours Tracker Database`.
3. Copy the Sheet ID from the URL.

Example URL:

```text
https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit
```

## Step 2: Add the Apps Script backend

1. In the Google Sheet, go to **Extensions > Apps Script**.
2. Open `google-apps-script/Code.gs` from this project.
3. Copy the entire file into Apps Script.
4. Replace this line:

```javascript
const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';
```

with your actual Sheet ID.

5. Change this line to a random token:

```javascript
const APP_TOKEN = 'change-this-token';
```

For example:

```javascript
const APP_TOKEN = 'cybears-hours-2026-random-long-text';
```

## Step 3: Deploy Apps Script as a web app

1. Click **Deploy > New deployment**.
2. Choose **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
5. Click **Deploy**.
6. Approve the permissions.
7. Copy the web app URL ending in `/exec`.

## Step 4: Configure the GitHub app

Open `config.js` and replace:

```javascript
SCRIPT_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
APP_TOKEN: "change-this-token"
```

with your Apps Script web app URL and the same token you used in `Code.gs`.

## Step 5: Put the app on GitHub Pages

1. Create a GitHub repository, such as `hours-tracker`.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
3. In GitHub, go to **Settings > Pages**.
4. Under **Build and deployment**, publish from the main branch and root folder.
5. GitHub will give you a URL like:

```text
https://YOUR-USERNAME.github.io/hours-tracker/
```

## Step 6: Embed in Squarespace

Add a Squarespace code block and paste:

```html
<iframe
  src="https://YOUR-USERNAME.github.io/hours-tracker/"
  width="100%"
  height="900"
  style="border:0; border-radius:16px; overflow:hidden;"
  title="Hours Tracker">
</iframe>
```

## Important security note

This is a simple classroom/club/small-program setup, not a secure payroll system.

The token helps prevent casual accidental submissions, but because the app is hosted publicly, a determined person could still view the token in the browser. Do not use this for private payroll, sensitive student data, or legally important timekeeping without a real login system.

## Suggested Sheet columns

The script creates these automatically:

1. Created At
2. Name
3. Date
4. Start Time
5. End Time
6. Break Minutes
7. Task
8. Notes
9. Total Hours
