export function isPreview(hostname) {
  return hostname === 'localhost'
    || hostname.endsWith('.hlx.page')
    || hostname.endsWith('-page.web.pfizer');
}

export function isNonProduction(hostname) {
  return isPreview(hostname)
    || hostname.endsWith('.hlx.reviews')
    || hostname.endsWith('.hlx.live')
    || hostname.endsWith('.web.pfizer');
}
