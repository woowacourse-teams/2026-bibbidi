#!/usr/bin/env bash

read_dotenv_value() {
  local key="$1"
  local file="$2"

  awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
      sub(/\r$/, "", value)
      print value
      exit
    }
  ' "$file"
}

initialize_tls_context() {
  : "${EC2_DEPLOY_PATH:=/opt/bibbidi/app}"

  case "$EC2_DEPLOY_PATH" in
    "~") EC2_DEPLOY_PATH="$HOME" ;;
    "~/"*) EC2_DEPLOY_PATH="$HOME/${EC2_DEPLOY_PATH#~/}" ;;
  esac

  NGINX_ENV="${TLS_ENV_FILE:-${EC2_DEPLOY_PATH}/.env.nginx}"
  [[ -f "$NGINX_ENV" ]] || {
    echo "Bibbidi environment file not found: $NGINX_ENV" >&2
    return 1
  }

  SERVER_NAME="$(read_dotenv_value SERVER_NAME "$NGINX_ENV")"
  CERT_DOMAIN="$(read_dotenv_value CERT_DOMAIN "$NGINX_ENV")"
  : "${SERVER_NAME:=${CERT_DOMAIN:-}}"
  : "${CERT_DOMAIN:?CERT_DOMAIN must be configured in $NGINX_ENV}"
  : "${SERVER_NAME:?SERVER_NAME must be configured in $NGINX_ENV}"

  CERT_ALT_DOMAIN="$(read_dotenv_value CERT_ALT_DOMAIN "$NGINX_ENV")"
  : "${CERT_ALT_DOMAIN:=www.${CERT_DOMAIN}}"
  CERT_LIVE_DIR="/etc/letsencrypt/live/${CERT_DOMAIN}"
  CERT_RENEWAL_CONF="/etc/letsencrypt/renewal/${CERT_DOMAIN}.conf"
  WEBROOT="${CERTBOT_WEBROOT:-${EC2_DEPLOY_PATH}/infra/nginx/certbot}"
  SSL_OPTIONS_FILE="/etc/letsencrypt/options-ssl-nginx.conf"
  DHPARAMS_FILE="/etc/letsencrypt/ssl-dhparams.pem"
}
