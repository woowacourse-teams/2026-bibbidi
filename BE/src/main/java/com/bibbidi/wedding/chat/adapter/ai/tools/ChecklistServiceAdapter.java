package com.bibbidi.wedding.chat.adapter.ai.tools;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.adapter.ai.client.SpringAiChatClient;
import com.bibbidi.wedding.chat.service.dto.prompt.ChecklistSnapshot;
import com.bibbidi.wedding.chat.service.port.ChecklistLookupPort;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import java.util.List;
import java.util.Optional;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

@Component
public class ChecklistServiceAdapter implements ChecklistLookupPort {

    private final ChecklistService checklistService;
    private final CatalogService catalogService;

    public ChecklistServiceAdapter(ChecklistService checklistService, CatalogService catalogService) {
        this.checklistService = checklistService;
        this.catalogService = catalogService;
    }

    @Tool(
            name = "getMyChecklist",
            description = "대화 중인 사용자의 체크리스트를 조회한다. exists가 false이면 체크리스트를 아직 만들지 않은 사용자다. 사용자의 준비 상태와 일정을 답할 때 호출한다."
    )
    public ChecklistSnapshot getMyChecklist(ToolContext toolContext) {
        return ChecklistSnapshot.of(findMyChecklistIfPresent(SpringAiChatClient.userIdOf(toolContext)));
    }

    @Tool(name = "getRecommendableItemIds", description = "대화 중인 사용자가 아직 체크리스트에 등록하지 않아 "
            + "추천할 수 있는 카탈로그 항목 ID를 조회한다. 항목을 추천하기 전에 호출한다.")
    public List<Long> getRecommendableItemIds(ToolContext toolContext) {
        Long userId = SpringAiChatClient.userIdOf(toolContext);
        List<Long> catalogItemIds = catalogService.findAllItemDetails().stream()
                .map(CatalogItemDetailSnapshot::id)
                .toList();
        return filterRecommendableCatalogItemIds(userId, catalogItemIds);
    }

    @Override
    public Optional<ChecklistWithAppointmentsResult> findMyChecklistIfPresent(Long userId) {
        return checklistService.findMyChecklistIfPresent(userId);
    }

    @Override
    public List<Long> filterRecommendableCatalogItemIds(Long userId, List<Long> catalogItemIds) {
        return checklistService.filterRecommendableCatalogItemIds(userId, catalogItemIds);
    }
}
