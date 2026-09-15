package com.bibbidi.wedding.user.repository;

import com.bibbidi.wedding.user.domain.WeddingDate;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import org.springframework.stereotype.Component;

@Component
public class WeddingDateMapper {

    public WeddingDate toDomain(JpaUserEntity entity) {
        return new WeddingDate(entity.id(), entity.weddingDate());
    }
}
