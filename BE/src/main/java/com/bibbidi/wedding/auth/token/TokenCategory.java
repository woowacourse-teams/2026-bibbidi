package com.bibbidi.wedding.auth.token;

public enum TokenCategory {

    ACCESS("access"),
    REFRESH("refresh");

    private final String claimValue;

    TokenCategory(String claimValue) {
        this.claimValue = claimValue;
    }

    public String claimValue() {
        return claimValue;
    }

    public boolean matches(String value) {
        return claimValue.equals(value);
    }
}
