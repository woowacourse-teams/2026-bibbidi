package com.bibbidi.wedding.terms.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "terms")
public class JpaTermsEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "version", nullable = false, length = 20)
    private String version;

    @Column(name = "title", nullable = false)
    private String title;

    @Lob
    @Column(name = "content", nullable = false)
    private String content;

    @Column(name = "required", nullable = false)
    private boolean required;

    protected JpaTermsEntity() {
    }

    public JpaTermsEntity(Long id, String code, String version, String title, String content, boolean required) {
        this.id = id;
        this.code = code;
        this.version = version;
        this.title = title;
        this.content = content;
        this.required = required;
    }

    public Long id() {
        return id;
    }

    public String code() {
        return code;
    }

    public String version() {
        return version;
    }

    public String title() {
        return title;
    }

    public String content() {
        return content;
    }

    public boolean required() {
        return required;
    }
}
