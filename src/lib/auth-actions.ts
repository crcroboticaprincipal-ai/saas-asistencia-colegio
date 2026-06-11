/**
 * Shared authentication actions for client components.
 * Centralises logout logic to avoid duplication between AdminSidebar and admin layout.
 */

/**
 * Sends a logout request to the server, clears any client-side
 * storage and navigates to /login.
 *
 * Using `window.location.href` (hard navigation) instead of
 * `router.push` ensures the browser discards the React client
 * tree and all in-memory state, preventing "back-button" re-entry.
 */
export async function handleLogout(): Promise<void> {
  try {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
  } catch {
    // Best-effort: even if the network call fails, clear local state
  } finally {
    // Clear any personal/docente session data stored client-side
    try {
      localStorage.removeItem('personal_access_token');
      localStorage.removeItem('personal_data');
    } catch {
      // localStorage not available (SSR guard)
    }
    // Hard redirect — clears React state and prevents back-button re-entry
    window.location.href = '/login';
  }
}
