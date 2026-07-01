const COGNITO_CONFIG = Object.freeze({
  region: "us-east-1",
  userPoolId: "us-east-1_Nn98cdkS9",
  clientId: "78ub41p21tn42ahgeo4frrhc42",
  domain: "https://us-east-1nn98cdks9.auth.us-east-1.amazoncognito.com",
  redirectPath: "/cognito-callback.html",
  postLoginPath: "/newHome.html",
  postLogoutPath: "/newHome.html",
  scopes: ["openid", "email", "profile"]
});

const STORAGE_KEYS = Object.freeze({
  accessToken: "Token",
  idToken: "idToken",
  refreshToken: "refreshToken",
  user: "user",
  codeVerifier: "cognito_code_verifier",
  state: "cognito_state"
});

const ADMIN_GROUP = "Admin";

function getAbsoluteUrl(path) {
  return new URL(path, window.location.origin).toString();
}

function getRedirectUri() {
  return getAbsoluteUrl(COGNITO_CONFIG.redirectPath);
}

function getPostLogoutUri() {
  return getAbsoluteUrl(COGNITO_CONFIG.postLogoutPath);
}

function toBase64Url(input) {
  let binary = "";
  new Uint8Array(input).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

function randomString(length = 64) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(values)
    .map((value) => charset[value % charset.length])
    .join("");
}

async function createCodeChallenge(codeVerifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return toBase64Url(digest);
}

function parseJwt(token) {
  if (!token || token.split(".").length !== 3) {
    throw new Error("Invalid JWT format.");
  }

  return JSON.parse(fromBase64Url(token.split(".")[1]));
}

function isExpired(token, clockSkewSeconds = 30) {
  try {
    const claims = parseJwt(token);
    if (!claims.exp) return false;
    return Date.now() >= (claims.exp - clockSkewSeconds) * 1000;
  } catch {
    return true;
  }
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.idToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
  sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
  sessionStorage.removeItem(STORAGE_KEYS.state);
}

function buildUserProfile(idToken) {
  const profile = parseJwt(idToken);
  const groups = profile["cognito:groups"] || [];

  return {
    userid: profile.sub,
    username: profile["cognito:username"] || profile.email || profile.sub,
    email: profile.email || "",
    type: groups.includes(ADMIN_GROUP) ? "Admin" : "user",
    groups
  };
}

async function exchangeCodeForTokens(code, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: COGNITO_CONFIG.clientId,
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: codeVerifier
  });

  const response = await fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Cognito token exchange failed: ${await response.text()}`);
  }

  return response.json();
}

export function getAccessToken() {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);

  if (!token || isExpired(token)) {
    clearAuthStorage();
    return null;
  }

  return token;
}

export function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    clearAuthStorage();
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export async function signIn() {
  const codeVerifier = randomString();
  const state = randomString(32);
  const codeChallenge = await createCodeChallenge(codeVerifier);

  sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
  sessionStorage.setItem(STORAGE_KEYS.state, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: COGNITO_CONFIG.clientId,
    redirect_uri: getRedirectUri(),
    scope: COGNITO_CONFIG.scopes.join(" "),
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge
  });

  window.location.assign(`${COGNITO_CONFIG.domain}/oauth2/authorize?${params.toString()}`);
}

export async function completeSignIn() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = sessionStorage.getItem(STORAGE_KEYS.state);
  const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);

  if (!code) {
    throw new Error("Cognito callback did not include an authorization code.");
  }

  if (!state || state !== expectedState || !codeVerifier) {
    clearAuthStorage();
    throw new Error("Cognito callback state validation failed.");
  }

  const tokens = await exchangeCodeForTokens(code, codeVerifier);
  const user = buildUserProfile(tokens.id_token);

  localStorage.setItem(STORAGE_KEYS.accessToken, tokens.access_token);
  localStorage.setItem(STORAGE_KEYS.idToken, tokens.id_token);
  if (tokens.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refresh_token);
  }
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));

  sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
  sessionStorage.removeItem(STORAGE_KEYS.state);

  return user;
}

export function signOut() {
  clearAuthStorage();

  const params = new URLSearchParams({
    client_id: COGNITO_CONFIG.clientId,
    logout_uri: getPostLogoutUri()
  });

  window.location.assign(`${COGNITO_CONFIG.domain}/logout?${params.toString()}`);
}

export function wireLogoutLinks() {
  document.querySelectorAll("#Logout").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      signOut();
    });
  });
}

export function updateAuthLinks() {
  const loginLink = document.getElementById("LoginLink");
  const logoutLink = document.getElementById("Logout");
  const authenticated = isAuthenticated();

  if (loginLink) loginLink.style.display = authenticated ? "none" : "inline";
  if (logoutLink) logoutLink.style.display = authenticated ? "inline" : "none";
}
