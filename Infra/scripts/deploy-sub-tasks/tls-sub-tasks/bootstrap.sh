#!/usr/bin/env bash

generate_bootstrap_cert() {
  sudo mkdir -p -- "$CERT_LIVE_DIR"
  local config status=0
  config=$(mktemp)

  cat > "$config" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${CERT_DOMAIN}

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${CERT_DOMAIN}
EOF

  if [[ -n "${CERT_ALT_DOMAIN:-}" ]]; then
    printf 'DNS.2 = %s\n' "$CERT_ALT_DOMAIN" >> "$config"
  fi

  sudo openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "$CERT_LIVE_DIR/privkey.pem" \
    -out "$CERT_LIVE_DIR/fullchain.pem" \
    -config "$config" \
    -extensions v3_req || status=$?
  rm -f -- "$config"
  [[ $status -eq 0 ]] || return "$status"

  sudo chmod 600 "$CERT_LIVE_DIR/privkey.pem"
  sudo chmod 644 "$CERT_LIVE_DIR/fullchain.pem"
}

ensure_ssl_options() {
  if sudo test -s "$SSL_OPTIONS_FILE" && sudo grep -q '^ssl_ciphers' "$SSL_OPTIONS_FILE"; then
    return 0
  fi

  sudo install -d -m 0755 -- "$(dirname "$SSL_OPTIONS_FILE")"
  sudo tee "$SSL_OPTIONS_FILE" >/dev/null <<'EOF'
# Managed by Bibbidi TLS bootstrap.
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
EOF
  sudo chmod 644 "$SSL_OPTIONS_FILE"
}

ensure_dhparams() {
  if sudo test -s "$DHPARAMS_FILE" && sudo openssl dhparam -in "$DHPARAMS_FILE" -noout >/dev/null 2>&1; then
    return 0
  fi

  sudo openssl dhparam -out "$DHPARAMS_FILE" 2048
  sudo chmod 644 "$DHPARAMS_FILE"
}

bootstrap_tls() {
  sudo mkdir -p -- "$WEBROOT/.well-known/acme-challenge"
  ensure_ssl_options
  ensure_dhparams

  if ! has_live_cert && ! has_renewal_conf; then
    generate_bootstrap_cert
  fi
}
