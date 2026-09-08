package com.bibbidi.wedding.catalog.controller;

import com.bibbidi.wedding.catalog.controller.dto.CatalogResponse;
import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.service.CatalogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/api/catalog")
    public CatalogResponse find() {
        Catalog catalog = catalogService.findPublicCatalog();
        return CatalogResponse.forPublic(catalog);
    }

    @GetMapping("/api/catalog/public")
    public CatalogResponse findPublicCatalog() {
        Catalog catalog = catalogService.findPublicCatalog();
        return CatalogResponse.forPublic(catalog);
    }
}
