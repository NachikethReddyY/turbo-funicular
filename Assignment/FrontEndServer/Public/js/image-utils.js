export function getGameImageSrc(gameImage, placeholder = "img/placeholder.png") {
  if (!gameImage) {
    return placeholder;
  }

  if (/^https?:\/\//i.test(gameImage)) {
    return gameImage;
  }

  if (/^[-+/=A-Za-z0-9]+$/.test(gameImage)) {
    return `data:image/jpeg;base64,${gameImage}`;
  }

  return placeholder;
}
