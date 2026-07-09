const COGNITO_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlaceholderUsername(username) {
  if (!username || typeof username !== "string") {
    return true;
  }

  const trimmed = username.trim();

  if (!trimmed) {
    return true;
  }

  if (/^pending_/i.test(trimmed)) {
    return true;
  }

  if (COGNITO_UUID_RE.test(trimmed)) {
    return true;
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9a-f]+$/i.test(trimmed)) {
    return true;
  }

  return false;
}

export function displayUsername(username, email) {
  if (!isPlaceholderUsername(username)) {
    return username;
  }

  if (email && email.includes("@")) {
    return email.split("@")[0];
  }

  return "User";
}

export function getInitials(name) {
  const cleaned = String(name || "U").trim();

  if (!cleaned) {
    return "U";
  }

  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
}

function colorFromName(name) {
  let hash = 0;

  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 58% 42%)`;
}

export function buildMonogramDataUrl(name, size = 64) {
  const initials = getInitials(name);
  const background = colorFromName(name || initials);
  const fontSize = Math.round(size * 0.38);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size / 2}" fill="${background}"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
      fill="#ffffff" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600">${initials}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getAvatarSrc(profilePicUrl, displayName, size = 64) {
  if (/^https?:\/\//i.test(profilePicUrl || "")) {
    return profilePicUrl;
  }

  if (/^[-+/=A-Za-z0-9]+$/.test(profilePicUrl || "")) {
    return `data:image/jpeg;base64,${profilePicUrl}`;
  }

  return buildMonogramDataUrl(displayName, size);
}
