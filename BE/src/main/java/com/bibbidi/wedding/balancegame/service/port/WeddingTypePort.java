package com.bibbidi.wedding.balancegame.service.port;

import com.bibbidi.wedding.balancegame.domain.WeddingType;
import java.util.List;

public interface WeddingTypePort {

    List<WeddingType> findAll();
}
