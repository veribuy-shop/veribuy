/**
 * Name shown for a person on public pages and to people they haven't traded
 * with. Businesses appear by their company name; everyone else by their
 * username, never their real name, so nobody can be looked up elsewhere.
 */
export function publicSellerName(profile: {
  accountType?: string | null;
  companyName?: string | null;
  username?: string | null;
} | null | undefined): string {
  if (!profile) return 'VeriBuy seller';
  if (profile.accountType === 'BUSINESS' && profile.companyName?.trim()) {
    return profile.companyName.trim();
  }
  return profile.username?.trim() || 'VeriBuy seller';
}

/** Prisma select for a user who will be shown to someone else. */
export const PUBLIC_USER_SELECT = {
  id: true,
  profile: { select: { username: true, accountType: true, companyName: true } },
} as const;

type PublicUserRow = { id: string; profile: Parameters<typeof publicSellerName>[0] };

/** Collapses a PUBLIC_USER_SELECT row to `{ id, name }`, where name is the public one. */
export function toPublicUser(user: PublicUserRow): { id: string; name: string };
export function toPublicUser(user: PublicUserRow | null): { id: string; name: string } | null;
export function toPublicUser(user: PublicUserRow | null) {
  return user ? { id: user.id, name: publicSellerName(user.profile) } : null;
}
