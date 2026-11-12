// A file opened from Explorer needs the local service, not file:// API requests.
// Leave hosted pages unchanged; the desktop shortcut starts the service if needed.
if (window.location.protocol === 'file:') {
  window.location.replace('http://127.0.0.1:43187/' + window.location.search);
}
