import { prisma } from "./database";

/**
 * Normalizes a full name by converting to lowercase, stripping special characters,
 * and collapsing multiple spaces.
 */
export function normalizeName(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates similarity percentage between two names using direct Levenshtein
 * distance as well as token-sorted similarity (to catch inverted first/last names).
 * Returns a value between 0.0 and 1.0 (e.g. 0.85 for 85%).
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0.0;

  // 1. Direct Levenshtein similarity
  const maxLen = Math.max(n1.length, n2.length);
  const levDist = levenshteinDistance(n1, n2);
  const levSimilarity = 1 - levDist / maxLen;

  // 2. Token Sort similarity (e.g., "John Doe" vs "Doe John")
  const tokens1 = n1.split(" ").sort().join(" ");
  const tokens2 = n2.split(" ").sort().join(" ");
  const tokenMaxLen = Math.max(tokens1.length, tokens2.length);
  const tokenDist = levenshteinDistance(tokens1, tokens2);
  const tokenSimilarity = 1 - tokenDist / tokenMaxLen;

  return Math.max(levSimilarity, tokenSimilarity);
}

/**
 * Checks whether the provided name has an 80% to 100% similarity match with
 * any existing user's full name in the Prisma database.
 */
export async function checkNameSimilarity(
  candidateName: string,
  excludeUserId?: string,
): Promise<{ isSimilar: boolean; highestMatchPercent: number; matchingName?: string }> {
  const normalizedCandidate = normalizeName(candidateName);
  if (!normalizedCandidate || normalizedCandidate.length < 2) {
    return { isSimilar: false, highestMatchPercent: 0 };
  }

  const existingUsers = await prisma.user.findMany({
    where: excludeUserId ? { id: { not: excludeUserId } } : undefined,
    select: { id: true, name: true },
  });

  let highestMatch = 0;
  let matchingName: string | undefined;

  for (const user of existingUsers) {
    if (!user.name) continue;
    const similarity = calculateNameSimilarity(candidateName, user.name);
    const percent = Math.round(similarity * 100);

    if (percent > highestMatch) {
      highestMatch = percent;
      matchingName = user.name;
    }
  }

  return {
    isSimilar: highestMatch >= 80,
    highestMatchPercent: highestMatch,
    matchingName,
  };
}

/**
 * Calculates similarity percentage between two email addresses.
 * Compares both the full email string and username prefix (handling aliases/dots).
 */
export function calculateEmailSimilarity(email1: string, email2: string): number {
  const e1 = email1.toLowerCase().trim();
  const e2 = email2.toLowerCase().trim();

  if (e1 === e2) return 1.0;
  if (!e1 || !e2) return 0.0;

  // 1. Full string similarity
  const maxLen = Math.max(e1.length, e2.length);
  const levDist = levenshteinDistance(e1, e2);
  const fullSimilarity = 1 - levDist / maxLen;

  // 2. Handle username prefix comparisons on the same domain
  const [user1, dom1] = e1.split("@");
  const [user2, dom2] = e2.split("@");

  if (dom1 && dom2 && dom1 === dom2) {
    const cleanUser1 = user1.replace(/\./g, "").split("+")[0];
    const cleanUser2 = user2.replace(/\./g, "").split("+")[0];

    if (cleanUser1 === cleanUser2) {
      return 1.0; // effectively identical alias on same domain
    }

    const userMaxLen = Math.max(cleanUser1.length, cleanUser2.length);
    const userDist = levenshteinDistance(cleanUser1, cleanUser2);
    const userSimilarity = 1 - userDist / userMaxLen;
    return Math.max(fullSimilarity, userSimilarity);
  }

  return fullSimilarity;
}

/**
 * Checks whether the provided email has an 80% to 100% similarity match with
 * any existing user's email address in the Prisma database.
 */
export async function checkEmailSimilarity(
  candidateEmail: string,
  excludeUserId?: string,
): Promise<{ isSimilar: boolean; highestMatchPercent: number; matchingEmail?: string }> {
  const cleanCandidate = candidateEmail.toLowerCase().trim();
  if (!cleanCandidate || !cleanCandidate.includes("@")) {
    return { isSimilar: false, highestMatchPercent: 0 };
  }

  const existingUsers = await prisma.user.findMany({
    where: excludeUserId ? { id: { not: excludeUserId } } : undefined,
    select: { id: true, email: true },
  });

  let highestMatch = 0;
  let matchingEmail: string | undefined;

  for (const user of existingUsers) {
    if (!user.email) continue;
    const similarity = calculateEmailSimilarity(cleanCandidate, user.email);
    const percent = Math.round(similarity * 100);

    if (percent > highestMatch) {
      highestMatch = percent;
      matchingEmail = user.email;
    }
  }

  return {
    isSimilar: highestMatch >= 80,
    highestMatchPercent: highestMatch,
    matchingEmail,
  };
}

