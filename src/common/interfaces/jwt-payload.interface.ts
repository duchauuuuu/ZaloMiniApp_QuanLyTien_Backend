export interface JwtPayload {
  sub: string;    // userId (uuid trong DB)
  zaloId: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface AuthenticatedUser {
  id: string;
  zaloId: string;
  displayName?: string;
  avatarUrl?: string;
}
