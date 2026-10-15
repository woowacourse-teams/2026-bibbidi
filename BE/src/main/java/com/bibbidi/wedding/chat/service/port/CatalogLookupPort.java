package com.bibbidi.wedding.chat.service.port;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import java.util.List;

public interface CatalogLookupPort {

    List<CatalogItemDetailSnapshot> findAllItemDetails();
}
