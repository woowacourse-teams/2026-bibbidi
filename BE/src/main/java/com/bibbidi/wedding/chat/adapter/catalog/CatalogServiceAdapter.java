package com.bibbidi.wedding.chat.adapter.catalog;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.service.port.CatalogLookupPort;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CatalogServiceAdapter implements CatalogLookupPort {

    private final CatalogService catalogService;

    public CatalogServiceAdapter(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Override
    public List<CatalogItemDetailSnapshot> findAllItemDetails() {
        return catalogService.findAllItemDetails();
    }
}
