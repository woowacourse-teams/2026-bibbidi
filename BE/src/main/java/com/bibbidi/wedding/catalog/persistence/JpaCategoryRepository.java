package com.bibbidi.wedding.catalog.persistence;

import com.bibbidi.wedding.catalog.service.dto.CategoryNameSnapshot;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaCategoryRepository extends JpaRepository<JpaCategoryEntity, Long> {

    List<CategoryNameSnapshot> findNamesByIdIn(Collection<Long> categoryIds);
}
