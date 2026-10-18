package com.bibbidi.wedding.checklist.persistence;

// 체크리스트와 항목을 한 번에 읽은 결과의 한 행. 항목이 없는 체크리스트는 item이 null이다.
public record ChecklistWithItem(JpaChecklistEntity checklist, JpaChecklistItemEntity item) {
}
