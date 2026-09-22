package com.bibbidi.wedding.auth.oidc.jwks;

import java.util.List;

public record OidcPublicKeySet(List<OidcPublicKey> keys) {
}
