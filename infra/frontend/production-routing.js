function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    /^\/(?:_next|api|assets|icon)(?:\/|$)/.test(uri) ||
    /\.[^/]+\/?$/.test(uri)
  ) {
    return request;
  }

  request.uri = uri.replace(/\/$/, "") + "/index.html";
  return request;
}
