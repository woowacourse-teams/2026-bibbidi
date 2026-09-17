#!/usr/bin/env bash

has_live_cert() {
  sudo test -s "$CERT_LIVE_DIR/fullchain.pem" && sudo test -s "$CERT_LIVE_DIR/privkey.pem"
}

has_renewal_conf() {
  sudo test -s "$CERT_RENEWAL_CONF"
}

cert_issuer() {
  sudo openssl x509 -in "$CERT_LIVE_DIR/fullchain.pem" -noout -issuer 2>/dev/null || true
}

is_letsencrypt_cert() {
  cert_issuer | grep -qi "Let's Encrypt"
}

is_bootstrap_cert() {
  # openssl prints the issuer as `CN = example.com`, spaces included, so the
  # whitespace has to go before the name can be compared. Keep the comparison
  # out of a pipeline: under `set -o pipefail` a short-circuiting grep can kill
  # its upstream with SIGPIPE and fail the test even on a match.
  local issuer
  issuer="$(cert_issuer | tr -d '[:space:]')"
  [[ "$issuer" == *"CN=${CERT_DOMAIN}"* ]]
}

lineage_is_valid() {
  has_renewal_conf || return 1
  sudo certbot certificates --cert-name "$CERT_DOMAIN" >/dev/null 2>&1
}

renewal_conf_is_broken() {
  local status
  status=$(sudo certbot certificates --cert-name "$CERT_DOMAIN" 2>&1 || true)
  printf '%s\n' "$status" | grep -qE 'missing a required file reference|No certificates found'
}

remove_bootstrap_cert() {
  has_renewal_conf && return 1
  is_bootstrap_cert || return 1
  sudo rm -rf -- "$CERT_LIVE_DIR" "/etc/letsencrypt/archive/${CERT_DOMAIN}"
}

purge_broken_renewal_conf() {
  renewal_conf_is_broken || return 0
  sudo rm -f -- "$CERT_RENEWAL_CONF"
}

verify_canonical_lineage() {
  has_live_cert || {
    echo "Let's Encrypt certificate was not created at $CERT_LIVE_DIR" >&2
    return 1
  }
}
