package com.bibbidi.wedding.auth.oidc.jwks;

import java.util.List;

/** 제공자가 공개한 서명 키 묶음이다. */
public record JsonWebKeySet(List<JsonWebKey> keys) {
}
