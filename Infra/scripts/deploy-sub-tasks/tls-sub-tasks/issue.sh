#!/usr/bin/env bash

issue_certificate() {
  local registration=(--register-unsafely-without-email)
  if [[ -n "${CERT_EMAIL:-}" ]]; then
    registration=(--email "$CERT_EMAIL" --no-eff-email)
  fi

  sudo certbot certonly --webroot \
    -w "$WEBROOT" \
    --non-interactive \
    --agree-tos \
    "${registration[@]}" \
    --keep-until-expiring \
    --cert-name "$CERT_DOMAIN" \
    -d "$CERT_DOMAIN" \
    -d "$CERT_ALT_DOMAIN"
}

reload_nginx() {
  docker exec nginx nginx -s reload
}

issue_tls() {
  purge_broken_renewal_conf

  if lineage_is_valid; then
    sudo certbot renew --quiet --webroot -w "$WEBROOT"
  elif has_live_cert && is_letsencrypt_cert; then
    echo "An existing Let's Encrypt certificate has no valid renewal lineage." >&2
    return 1
  else
    if has_live_cert && is_bootstrap_cert; then
      remove_bootstrap_cert
    fi
    issue_certificate
    verify_canonical_lineage
  fi

  reload_nginx
}
