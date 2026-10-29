package com.bibbidi.wedding.balancegame.repository;

import com.bibbidi.wedding.balancegame.domain.WeddingType;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

@Slf4j
@Repository
public class WeddingTypeRepository {

    private static final String LOCATION_NOT_SET_MESSAGE = "밸런스게임 유형 위치가 설정되지 않았습니다.";
    private static final String NOT_LOADED_MESSAGE = "밸런스게임 유형을 읽지 못해 응답할 수 없습니다. location=";
    private static final String LOAD_FAILURE_LOG = "밸런스게임 유형을 읽지 못했습니다. location={}";

    private final String location;
    private final @Nullable List<WeddingType> types;

    public WeddingTypeRepository(
            JsonContentReader reader,
            @Value("${bibbidi.balance-game.types-location}") String location
    ) {
        if (location.isBlank()) {
            throw new IllegalStateException(LOCATION_NOT_SET_MESSAGE);
        }
        this.location = location;
        this.types = load(reader);
    }

    public List<WeddingType> findAll() {
        if (types == null) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, NOT_LOADED_MESSAGE + location);
        }

        return types;
    }

    private @Nullable List<WeddingType> load(JsonContentReader reader) {
        try {
            return reader.readList(location, WeddingType.class);
        } catch (IOException | RuntimeException exception) {
            log.error(LOAD_FAILURE_LOG, location, exception);
            return null;
        }
    }
}
