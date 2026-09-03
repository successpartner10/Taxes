import { AppUser, AccessControlSettings } from '../types';

const STORAGE_ACTIVE_USER_KEY = 'canadian_tax_active_user_v1';
const STORAGE_ACCESS_SETTINGS_KEY = 'canadian_tax_access_settings_v1';

// Default authorized emails: specifically includes sulaniyashpal@gmail.com and sandipyashpal@gmail.com
export const DEFAULT_ALLOWED_EMAILS = [
  'sulaniyashpal@gmail.com',
  'sandipyashpal@gmail.com',
];

export const GOOGLE_CLIENT_ID = '341742751070-ov47a1o42o010f10h0q2grtidm1uj7pv.apps.googleusercontent.com';

export function getStoredAccessSettings(): AccessControlSettings {
  try {
    const raw = localStorage.getItem(STORAGE_ACCESS_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure sulaniyashpal@gmail.com and sandipyashpal@gmail.com are always included
      const emails = Array.isArray(parsed.allowedEmails) ? parsed.allowedEmails : DEFAULT_ALLOWED_EMAILS;
      const normalizedEmails = Array.from(
        new Set([
          ...DEFAULT_ALLOWED_EMAILS.map((e) => e.toLowerCase()),
          ...emails.map((e: string) => e.toLowerCase()),
        ])
      );
      return {
        allowedEmails: normalizedEmails,
        allowAllAuthenticatedUsers: parsed.allowAllAuthenticatedUsers ?? true, // "All of them" default true
      };
    }
  } catch (err) {
    console.error('Failed to parse access settings', err);
  }

  return {
    allowedEmails: DEFAULT_ALLOWED_EMAILS.map((e) => e.toLowerCase()),
    allowAllAuthenticatedUsers: true, // "All of them"
  };
}

export function saveAccessSettings(settings: AccessControlSettings): void {
  try {
    // Make sure sulaniyashpal@gmail.com and sandipyashpal@gmail.com are never removed accidentally
    const normalized = Array.from(
      new Set([
        ...DEFAULT_ALLOWED_EMAILS.map((e) => e.toLowerCase()),
        ...settings.allowedEmails.map((e) => e.toLowerCase().trim()),
      ])
    ).filter(Boolean);

    localStorage.setItem(
      STORAGE_ACCESS_SETTINGS_KEY,
      JSON.stringify({
        ...settings,
        allowedEmails: normalized,
      })
    );
  } catch (err) {
    console.error('Failed to save access settings', err);
  }
}

export function isEmailAllowed(email: string): boolean {
  if (!email) return false;
  const settings = getStoredAccessSettings();
  if (settings.allowAllAuthenticatedUsers) {
    return true;
  }
  const clean = email.trim().toLowerCase();
  return settings.allowedEmails.some((allowed) => allowed.toLowerCase() === clean);
}

export function getActiveUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse active user', err);
  }
  return null;
}

export function setActiveUser(user: AppUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_ACTIVE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_USER_KEY);
    }
  } catch (err) {
    console.error('Failed to save active user', err);
  }
}

// Decode Google JWT ID token
export function parseGoogleJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse Google JWT', e);
    return null;
  }
}

export function maskEmail(email: string): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '••••••••';
  const [user, domain] = parts;
  const maskedUser = user.length <= 3 ? `${user[0]}•••` : `${user.slice(0, 2)}••••${user.slice(-1)}`;
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.length > 1 ? `••••.${domainParts[domainParts.length - 1]}` : '••••';
  return `${maskedUser}@${maskedDomain}`;
}

export function createOrUpdateUserFromGoogle(jwtToken: string): { user: AppUser | null; error?: string } {
  const payload = parseGoogleJwtPayload(jwtToken);
  if (!payload || !payload.email) {
    return { user: null, error: 'Invalid Google account credential' };
  }

  const email = payload.email.toLowerCase();
  if (!isEmailAllowed(email)) {
    return {
      user: null,
      error: 'Access Denied: This account is not authorized to access this ledger. Please sign in with an authorized corporate account.',
    };
  }

  const role: AppUser['role'] =
    email === 'sandipyashpal@gmail.com'
      ? 'owner'
      : email === 'sulaniyashpal@gmail.com'
      ? 'authorized_user'
      : 'team_member';

  const user: AppUser = {
    email,
    name: payload.name || payload.given_name || (email === 'sulaniyashpal@gmail.com' ? 'Sulani Yashpal' : email === 'sandipyashpal@gmail.com' ? 'Sandip Yashpal' : 'Authorized User'),
    picture: payload.picture,
    role,
    lastLogin: new Date().toISOString(),
  };

  setActiveUser(user);
  return { user };
}

// Quick sign-in helper (for instant authorization testing and one-click access)
export function quickSignIn(email: string, displayName?: string): AppUser {
  const cleanEmail = email.toLowerCase().trim();
  const role: AppUser['role'] =
    cleanEmail === 'sandipyashpal@gmail.com'
      ? 'owner'
      : cleanEmail === 'sulaniyashpal@gmail.com'
      ? 'authorized_user'
      : 'team_member';

  const name =
    displayName ||
    (cleanEmail === 'sulaniyashpal@gmail.com'
      ? 'Sulani Yashpal'
      : cleanEmail === 'sandipyashpal@gmail.com'
      ? 'Sandip Yashpal'
      : cleanEmail.split('@')[0]);

  const user: AppUser = {
    email: cleanEmail,
    name,
    role,
    lastLogin: new Date().toISOString(),
  };

  setActiveUser(user);
  return user;
}
