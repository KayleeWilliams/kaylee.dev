// Rounds down: callers append "+", so the shown figure must be a floor.
function floorTo1Decimal(value: number): string {
  return (Math.floor(value * 10) / 10).toFixed(1);
}

export function formatDownloads(downloads: number): string {
  const million = 1_000_000;
  const thousand = 1000;
  if (downloads >= million) {
    return `${floorTo1Decimal(downloads / million)}M`;
  }
  if (downloads >= thousand) {
    return `${floorTo1Decimal(downloads / thousand)}k`;
  }
  return downloads.toLocaleString();
}
