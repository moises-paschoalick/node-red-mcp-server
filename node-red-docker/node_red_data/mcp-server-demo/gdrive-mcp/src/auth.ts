import { google } from "googleapis";
import fs from "fs";
import path from "path";

export const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

// Create OAuth2 client with env vars
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

// Ensure credentials directory exists
const CREDS_DIR =
  process.env.GDRIVE_CREDS_DIR ||
  path.join(path.dirname(new URL(import.meta.url).pathname), "../../../");

function ensureCredsDirectory() {
  try {
    fs.mkdirSync(CREDS_DIR, { recursive: true });
    console.error(`Ensured credentials directory exists at: ${CREDS_DIR}`);
  } catch (error) {
    console.error(
      `Failed to create credentials directory: ${CREDS_DIR}`,
      error
    );
    throw error;
  }
}

// Path to store credentials
const credentialsPath = path.join(CREDS_DIR, ".gdrive-server-credentials.json");

async function refreshToken() {
  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      scope: SCOPES.join(' ')
    });

    const { credentials } = await client.refreshAccessToken();
    return credentials;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export async function getValidCredentials(forceAuth = false) {
  console.error("Loading credentials using environment variables...");

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) {
    console.error("Missing Google API credentials in environment variables.");
    return null;
  }

  const credentials = await refreshToken();
  if (!credentials) {
    return null;
  }

  console.error("Access token refreshed successfully.");
  ensureCredsDirectory();
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));

  oauth2Client.setCredentials(credentials);
  return oauth2Client;
}

export async function loadCredentialsQuietly() {
  console.error("Attempting to load credentials from environment variables...");

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) {
    console.error("Missing credentials in environment variables.");
    return null;
  }

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.error("Token refreshed successfully.");
    oauth2Client.setCredentials(credentials);
    return oauth2Client;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return null;
  }
}

export function setupTokenRefresh() {
  console.error("Setting up automatic token refresh every 45 minutes");
  return setInterval(async () => {
    try {
      console.error("Running scheduled token refresh");
      const auth = await loadCredentialsQuietly();
      if (auth) {
        google.options({ auth });
        console.error("Token refreshed successfully.");
      } else {
        console.error("Skipping refresh - no valid credentials.");
      }
    } catch (error) {
      console.error("Error during scheduled refresh:", error);
    }
  }, 45 * 60 * 1000);
}