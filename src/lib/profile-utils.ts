export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getYearsCreating(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const years = now.getFullYear() - created.getFullYear();
  const monthDiff = now.getMonth() - created.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < created.getDate())) {
    return Math.max(1, years);
  }
  return Math.max(1, years);
}

export function getCollectionTitle(displayName: string): string {
  const firstName = displayName.split(/\s+/)[0] || displayName;
  return `${firstName.toUpperCase()}'S COLLECTION`;
}
