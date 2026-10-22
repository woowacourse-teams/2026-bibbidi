package com.bibbidi.wedding.chat.adapter.ai.tools;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.port.CatalogLookupPort;
import java.util.List;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

@Component
public class CatalogServiceAdapter implements CatalogLookupPort {

    private final CatalogService catalogService;

    public CatalogServiceAdapter(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Override
    @Tool(
            name = "getCatalog",
            description = "추천할 수 있는 준비 항목 카탈로그 전체를 조회한다. 항목을 추천하기 전에 호출한다."
    )
    public List<CatalogItemDetailSnapshot> findAllItemDetails() {
        return catalogService.findAllItemDetails();
    }
}
