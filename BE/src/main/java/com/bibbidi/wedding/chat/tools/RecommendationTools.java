package com.bibbidi.wedding.chat.tools;

import com.bibbidi.wedding.checklist.service.ChecklistService;
import java.util.List;
import java.util.function.Consumer;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

public class RecommendationTools {

    private final ChecklistService checklistService;
    private final Consumer<List<Long>> sendComponent;

    public RecommendationTools(ChecklistService checklistService, Consumer<List<Long>> sendComponent) {
        this.checklistService = checklistService;
        this.sendComponent = sendComponent;
    }

    @Tool(description = "조회한 카탈로그의 추천 항목을 카드로 표시한다. 실제로 표시한 항목 ID를 반환하며, 빈 결과이면 카드를 표시하지 않는다.")
    public List<Long> showRecommendations(
            @ToolParam(description = "조회한 카탈로그에서 선택한 항목 ID 배열. 추천 순서대로 전달한다.") List<Long> catalogItemIds,
            ToolContext context
    ) {
        Long userId = ChatToolContext.from(context).userId();
        List<Long> ids = checklistService.filterRecommendableCatalogItemIds(userId, catalogItemIds);
        if (!ids.isEmpty()) {
            sendComponent.accept(ids);
        }
        return ids;
    }
}
