package com.bibbidi.wedding.chat.tools;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import java.util.List;
import org.springframework.ai.tool.annotation.Tool;

public class CatalogTools {

    private final CatalogService catalogService;

    public CatalogTools(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Tool(description = "실제 결혼 준비 카탈로그의 항목 ID, 제목, 카테고리, 준비 단계와 시기를 조회한다.")
    public List<CatalogItemDetailSnapshot> findCatalog() {
        return catalogService.findAllItemDetails();
    }
}
