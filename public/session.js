export const AUTO_SESSION_LABEL = 'Auto-follow active chats';

export function initialSession(search = '') {
  const params = new URLSearchParams(search);
  // Old links only contained ?session=. They must not silently disable auto-follow.
  return params.get('follow') === 'pinned' && params.get('session') || 'auto';
}

export function sessionUrl(selected) {
  return selected === 'auto' ? '/' : `/?session=${encodeURIComponent(selected)}&follow=pinned`;
}
