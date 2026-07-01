# Hours Tracker

A simple static hours-tracking web app designed to be hosted on GitHub Pages, displayed inside Squarespace, and backed by a Google Sheet through Google Apps Script.

## Files

- `index.html` - app layout
- `styles.css` - app styling
- `app.js` - browser-side app logic
- `config.js` - Google Apps Script URL and app token
- `google-apps-script/Code.gs` - backend code to paste into Apps Script

## Google Sheet setup

Create one Google Sheet. The script uses two tabs in that same spreadsheet:

### `Hours`

This tab stores submissions. The script will create it automatically if it does not exist.

Columns:

1. Created At
2. Name
3. Date
4. Start Time
5. End Time
6. Task
7. Notes
8. Total Hours

The old `Break Minutes` column is no longer used. If the script sees the original old layout, it will remove that column automatically.

### `ApprovedUsers`

This tab controls who can submit hours. Create a tab named exactly:

```txt
ApprovedUsers
```

Put these headers in row 1:

```txt
Username | PIN
```

Example:

| Username | PIN |
| --- | --- |
| Matt Cain | 1234 |
| Student Name | 2468 |

The `Username` values automatically appear in the app's name dropdown. The PIN is checked when hours are submitted.

## Apps Script setup

1. Open the Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Paste the full contents of `google-apps-script/Code.gs` into the Apps Script editor.
4. Change this line:

```js
const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';
```

Use the ID from your Google Sheet URL:

```txt
https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
```

5. Change this line:

```js
const APP_TOKEN = 'change-this-token';
```

Use a long token and match it in `config.js`.

6. Run `testSheetConnection` once to authorize permissions and verify the spreadsheet connection.
7. Deploy as a web app:
   - **Execute as:** Me
   - **Who has access:** Anyone
8. Copy the deployed `/exec` URL.

## App config

Open `config.js` and update both values:

```js
window.HOURS_APP_CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
  APP_TOKEN: 'same-token-used-in-Code.gs'
};
```

The token in `config.js` must exactly match the token in `Code.gs`.

## GitHub Pages

1. Upload the app files to a GitHub repository.
2. Go to **Settings > Pages**.
3. Select:
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/root`
4. Save.
5. Use the published GitHub Pages URL.

## Squarespace embed

Add a Squarespace Code Block and paste:

```html
<iframe
  src="https://YOUR-USERNAME.github.io/hours-tracker/"
  width="100%"
  height="900"
  style="border:0; border-radius:16px; overflow:hidden;"
  title="Hours Tracker">
</iframe>
```

Replace the `src` URL with your actual GitHub Pages URL.

## Security note

This is a lightweight tracker, not a secure payroll system. The app token is visible in the browser because the app is static. The user PIN check is better than an open form, but it is still appropriate only for simple internal, classroom, club, or volunteer tracking.
