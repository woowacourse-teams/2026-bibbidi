-- 준비 목록 초기 데이터

USE bibbidi;

-- 카테고리
INSERT INTO categories (id, name, display_order, created_at, updated_at) VALUES
(1, '웨딩홀', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, '스드메', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, '초대', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, '가족', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, '기타', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
AS new ON DUPLICATE KEY UPDATE
    name          = new.name,
    display_order = new.display_order,
    updated_at    = CURRENT_TIMESTAMP;

-- 단계
INSERT INTO steps (id, category_id, name, description, icon_url, display_order, created_at, updated_at) VALUES
-- 웨딩홀
(1, 1, '웨딩홀 투어와 계약',
 '후보 웨딩홀을 직접 돌아보고 조건을 비교한 뒤 한 곳과 계약한다.',
 'https://www.bibbidi.kr/icon/wedding/venue-hall-tour.png', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 1, '예식 형태·식순·입장 방식 결정',
 '예식을 어떤 형태로 치를지 정하고 식순과 입장 연출까지 확정한다.',
 'https://www.bibbidi.kr/icon/wedding/venue-ceremony-program.png', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 1, '예식 진행자와 당일 도우미 섭외',
 '주례와 사회자, 축가 담당을 구하고 당일 손을 보탤 사람도 함께 정한다.',
 'https://www.bibbidi.kr/icon/wedding/venue-host-staff.png', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 1, '예식 대본과 음원·영상 준비',
 '사회자 대본과 선언문을 쓰고 식전영상과 본식 음원을 만들어 웨딩홀에 넘긴다.',
 'https://www.bibbidi.kr/icon/wedding/venue-script-music.png', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 1, '본식 촬영·기록 업체 계약',
 '본식을 사진과 영상으로 남길 업체를 골라 계약한다.',
 'https://www.bibbidi.kr/icon/wedding/venue-videographer.png', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, 1, '예식 물품과 답례품 준비',
 '부케와 접수대 물품처럼 예식장에 놓을 것과 하객에게 줄 답례품을 챙긴다.',
 'https://www.bibbidi.kr/icon/wedding/venue-supplies-favors.png', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(7, 1, '웨딩홀 시식·리허설과 본식 당일 준비',
 '식사와 동선을 미리 겪어보고 이동 차량, 전날 숙박, 당일 짐까지 갖춘다.',
 'https://www.bibbidi.kr/icon/wedding/venue-tasting-rehearsal.png', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8, 1, '본식 당일 진행',
 '예식 당일을 치른다.',
 'https://www.bibbidi.kr/icon/wedding/venue-ceremony-day.png', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(9, 1, '예식 비용 정산과 사례비 전달',
 '예식 비용을 정산하고 도와준 사람들에게 사례비를 전한다.',
 'https://www.bibbidi.kr/icon/wedding/venue-final-payment.png', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- 스드메
(10, 2, '스드메 상담·견적과 패키지 계약',
 '플래너 상담과 박람회로 시세를 알아보고 패키지 구성을 정해 계약까지 마친다.',
 'https://www.bibbidi.kr/icon/styling/sdm-package-contract.png', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(11, 2, '스드메 업체 확정과 촬영일 예약',
 '드레스샵과 스튜디오, 헤어메이크업 샵을 각각 정하고 촬영 날짜를 잡는다.',
 'https://www.bibbidi.kr/icon/styling/sdm-booking-schedule.png', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(12, 2, '촬영 드레스·예복 가봉과 헤어변형·헬퍼 예약',
 '촬영에 입을 드레스와 예복을 고르고 가봉하며 헤어변형과 헬퍼도 미리 잡는다.',
 'https://www.bibbidi.kr/icon/styling/sdm-dress-fitting.png', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(13, 2, '촬영 시안 제작과 업체 전달',
 '원하는 촬영 분위기를 시안으로 만들어 업체에 넘긴다.',
 'https://www.bibbidi.kr/icon/styling/sdm-concept-board.png', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(14, 2, '촬영 추가 착장과 소품 준비',
 '패키지에 없는 착장과 부케, 붙임머리 같은 소품을 따로 챙긴다.',
 'https://www.bibbidi.kr/icon/styling/sdm-outfits-props.png', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(15, 2, '웨딩 촬영 당일 진행',
 '촬영 당일을 치르고 야외 스냅을 더할지 정한다.',
 'https://www.bibbidi.kr/icon/styling/sdm-photoshoot-day.png', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(16, 2, '촬영 사진 셀렉·보정과 앨범·액자 주문',
 '찍은 사진에서 쓸 컷을 고르고 보정을 받은 뒤 앨범과 액자를 주문한다.',
 'https://www.bibbidi.kr/icon/styling/sdm-album-frame.png', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(17, 2, '본식 드레스·예복 계약과 헤어메이크업·소품 결정',
 '본식에 입을 드레스와 예복을 계약하고 헤어메이크업과 베일, 슈즈까지 정한다.',
 'https://www.bibbidi.kr/icon/styling/sdm-wedding-attire.png', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(18, 2, '대여 물품 반납',
 '빌려 쓴 물품을 돌려준다.',
 'https://www.bibbidi.kr/icon/styling/sdm-rental-return.png', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- 초대
(19, 3, '하객 범위 결정과 명단 작성',
 '누구를 부를지 범위를 정하고 예상 인원과 명단까지 만든다.',
 'https://www.bibbidi.kr/icon/invitation/guests-list.png', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(20, 3, '청첩장 문구 작성과 화환 여부 결정',
 '청첩장에 들어갈 문구를 쓰고 화환을 받을지도 함께 정한다.',
 'https://www.bibbidi.kr/icon/invitation/guests-invitation-wording.png', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(21, 3, '모바일·종이 청첩장 제작과 주문',
 '모바일과 종이 청첩장 업체를 각각 골라 수량을 정하고 주문한다.',
 'https://www.bibbidi.kr/icon/invitation/guests-invitation-order.png', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(22, 3, '청첩장 모임과 전달',
 '청첩장 모임을 열어 직접 건네고 나머지는 모바일로 보낸다.',
 'https://www.bibbidi.kr/icon/invitation/guests-invitation-delivery.png', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(23, 3, '참석 인원 확정과 식장 통보',
 '최종 참석 인원을 정해 식장에 보증인원으로 통보한다.',
 'https://www.bibbidi.kr/icon/invitation/guests-attendance-confirm.png', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(24, 3, '하객 셔틀버스와 교통비 준비',
 '멀리서 오는 하객을 위해 버스를 잡고 교통비를 챙긴다.',
 'https://www.bibbidi.kr/icon/invitation/guests-shuttle-bus.png', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(25, 3, '식권 준비',
 '하객에게 나눠 줄 식권을 준비한다.',
 'https://www.bibbidi.kr/icon/invitation/guests-meal-ticket.png', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(26, 3, '식대 정산과 축의금 정리',
 '남은 식권과 식대를 정산하고 축의금과 명단을 정리한다.',
 'https://www.bibbidi.kr/icon/invitation/guests-settlement.png', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(27, 3, '하객 감사 인사 전달',
 '와준 하객에게 감사 인사를 전한다.',
 'https://www.bibbidi.kr/icon/invitation/guests-thank-you.png', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- 가족
(28, 4, '상견례 일정·장소 예약과 진행',
 '양가가 만날 날짜와 장소를 잡아 상견례를 치르고 그 자리에서 예식 일정까지 조율한다.',
 'https://www.bibbidi.kr/icon/family/family-meeting.png', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(29, 4, '예단 여부 협의와 날짜 결정',
 '예단을 주고받을지 양가와 이야기하고 보낼 날짜를 잡는다.',
 'https://www.bibbidi.kr/icon/family/family-yedan-gift.png', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(30, 4, '폐백 여부 결정과 진행',
 '폐백을 할지 정하고 예식 당일 폐백을 드린다.',
 'https://www.bibbidi.kr/icon/family/family-pyebaek.png', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(31, 4, '혼주 한복·예복 계약과 소품 준비',
 '혼주 한복을 계약해 가봉하고 정장과 드레스, 구두, 코사지까지 갖춘다.',
 'https://www.bibbidi.kr/icon/family/family-parents-hanbok.png', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(32, 4, '형제자매·조부모 의상 준비',
 '형제자매와 조부모가 예식에 입을 옷을 챙긴다.',
 'https://www.bibbidi.kr/icon/family/family-relatives-outfits.png', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(33, 4, '혼주 헤어·메이크업 예약',
 '혼주 헤어와 메이크업을 예약하고 인원과 출장 여부를 정한다.',
 'https://www.bibbidi.kr/icon/family/family-hair-makeup.png', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(34, 4, '가족 대여 물품 반납',
 '빌려 쓴 가족 물품을 돌려준다.',
 'https://www.bibbidi.kr/icon/family/family-rental-return.png', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- 기타
(35, 5, '총예산 수립과 예식 기본 조건 결정',
 '전체 예산과 예비비를 잡고 예식 시기와 지역 같은 기본 조건을 정한다.',
 'https://www.bibbidi.kr/icon/etc/etc-budget.png', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(36, 5, '결혼반지 투어와 계약',
 '웨딩밴드 매장을 돌아보고 반지를 골라 계약한다.',
 'https://www.bibbidi.kr/icon/etc/etc-wedding-rings.png', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(37, 5, '웨딩 전 피부·치아·헤어 관리 예약',
 '촬영과 본식 전에 받을 피부, 치아, 헤어 관리 일정을 미리 잡는다.',
 'https://www.bibbidi.kr/icon/etc/etc-beauty-care.png', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(38, 5, '신혼여행지 결정과 항공·숙소 예약',
 '어디로 갈지 정해 항공권과 숙소를 예약한다.',
 'https://www.bibbidi.kr/icon/etc/etc-honeymoon-booking.png', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(39, 5, '출국 준비와 해외 결제 수단 마련',
 '여권과 비자를 챙기고 환전과 해외 결제 수단, 로밍을 준비한다.',
 'https://www.bibbidi.kr/icon/etc/etc-travel-prep.png', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(40, 5, '신혼집 계약과 인테리어 범위 결정',
 '살 집을 구해 계약하고 고칠 범위를 정한다.',
 'https://www.bibbidi.kr/icon/etc/etc-home-contract.png', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(41, 5, '혼수 구입과 이사 준비',
 '혼수 목록을 정해 가전과 가구를 계약하고 이사 업체를 잡는다.',
 'https://www.bibbidi.kr/icon/etc/etc-appliances-moving.png', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(42, 5, '신혼집 입주와 전입신고',
 '새 집에 들어가 전입신고와 확정일자까지 마친다.',
 'https://www.bibbidi.kr/icon/etc/etc-move-in.png', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(43, 5, '혼인신고 접수',
 '구청에 혼인신고를 접수한다.',
 'https://www.bibbidi.kr/icon/etc/etc-marriage-registration.png', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
AS new ON DUPLICATE KEY UPDATE
    category_id   = new.category_id,
    name          = new.name,
    description   = new.description,
    icon_url      = new.icon_url,
    display_order = new.display_order,
    updated_at    = CURRENT_TIMESTAMP;

-- 준비 항목
INSERT INTO catalog_items (id, step_id, title, display_order, essential, created_at, updated_at) VALUES
(1, 1, '웨딩홀 투어', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 1, '웨딩홀 계약', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(3, 2, '예식 형태 결정', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 2, '입장 방식 결정', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 2, '식순 준비', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(6, 3, '주례·사회자 섭외', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(7, 3, '축가·축사·덕담 섭외', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8, 3, '가방순이 섭외', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(9, 3, '부케순이 섭외', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(10, 3, '축의대 담당자 섭외·역할 안내', 5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(11, 3, '헬퍼비·사례비 봉투 준비', 6, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(12, 4, '사회자 대본 준비', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(13, 4, '성혼선언문 준비', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(14, 4, '혼인서약문 준비', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(15, 4, '본식음원 선정', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(16, 4, '식전영상 제작', 5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(17, 4, '식전영상 웨딩홀 전달', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(18, 4, '본식음원 웨딩홀 전달', 7, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(19, 5, '본식스냅 계약', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(20, 5, '본식DVD 계약', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(21, 5, '서브스냅 계약', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(22, 5, '아이폰스냅 계약', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(23, 6, '포토부스 설치 여부 결정', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(24, 6, '답례 대상·수량 정리', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(25, 6, '답례품 준비', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(26, 6, '포토테이블용 사진·액자 준비', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(27, 6, '식권·식순지·접수대 봉투 준비', 5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(28, 6, '부케·부토니아·코사지 예약', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(29, 7, '웨딩홀 시식', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(30, 7, '웨딩홀 리허설 방문', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(31, 7, '본식 전날 숙박 예약', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(32, 7, '예식장 이동 차량·트렁크 준비', 4, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(33, 7, '본식 당일 개인 준비물 준비', 5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(34, 8, '본식 진행', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(35, 9, '예식비용 정산', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(36, 9, '사례비 전달', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(37, 10, '웨딩박람회 방문', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(38, 10, '플래너 배정과 상담', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(39, 10, '스드메 상담', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(40, 10, '스드메 견적 수령', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(41, 10, '스드메 구성 결정', 5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(42, 10, '스드메 계약', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(43, 10, '계약금·중도금·잔금 일정 확정', 7, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(44, 11, '드레스샵 투어', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(45, 11, '스튜디오 선택', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(46, 11, '메이크업 상담', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(47, 11, '드레스샵 확정', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(48, 11, '헤어메이크업 샵 선택', 5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(49, 11, '촬영 날짜 확정', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(50, 11, '헤어메이크업 일정 확정', 7, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(51, 12, '가봉 전 드레스 시착', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(52, 12, '촬영 드레스 선택과 가봉', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(53, 12, '촬영용 대여복 선택', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(54, 12, '맞춤 예복 치수 측정', 4, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(55, 12, '예복 가봉', 5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(56, 12, '촬영 헤어변형 여부 결정', 6, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(57, 12, '헤어변형 업체 별도 예약', 7, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(58, 12, '촬영 플라워디렉팅 예약', 8, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(59, 12, '촬영 헬퍼 섭외', 9, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(60, 13, '촬영 시안 제작', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(61, 13, '참고 사진·레퍼런스 전달', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(62, 14, '자유복·캐주얼 착장 준비', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(63, 14, '한복 촬영 착장 준비', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(64, 14, '붙임머리·가발 준비', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(65, 14, '촬영 부케 준비', 4, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(66, 15, '야외·추가 스냅 여부 결정', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(67, 15, '스튜디오 촬영 진행', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(68, 16, '촬영 사진 셀렉', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(69, 16, '보정본 수령', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(70, 16, '앨범 구성 결정과 주문', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(71, 16, '액자 주문', 4, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(72, 17, '예복 맞춤·기성·대여 결정', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(73, 17, '예복 상담과 계약', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(74, 17, '본식 드레스샵 계약', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(75, 17, '본식 드레스 선택과 가봉', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(76, 17, '2부 드레스 결정', 5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(77, 17, '넥타이·보타이 선택', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(78, 17, '베일 선택', 7, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(79, 17, '헤어피스·티아라 등 머리 장식 결정', 8, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(80, 17, '웨딩슈즈 준비', 9, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(81, 17, '속옷·이너 준비', 10, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(82, 17, '본식 헤어 결정', 11, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(83, 17, '2부 헤어변형 여부 결정', 12, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(84, 17, '본식 메이크업 진행', 13, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(85, 18, '대여 물품 반납', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(86, 19, '하객 초대 범위 결정', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(87, 19, '예상 하객수 산정', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(88, 19, '하객 명단 작성', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(89, 20, '청첩장 문구 작성', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(90, 20, '청첩장 교통·주차 안내 반영', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(91, 20, '화환 수령 여부 결정', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(92, 21, '종이 청첩장 업체 선택', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(93, 21, '청첩장 수량 결정', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(94, 21, '청첩장 검수', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(95, 21, '청첩장 주문', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(96, 21, '모바일 청첩장 업체 선택', 5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(97, 21, '모바일 청첩장 제작', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(98, 22, '청첩장 모임 진행', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(99, 22, '종이 청첩장 직접 전달', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(100, 22, '모바일 청첩장 발송', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(101, 23, '식장 보증 인원 통보', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(102, 24, '셔틀·대절버스 예약', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(103, 24, '장거리 하객 숙박 준비', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(104, 24, '하객 교통비 준비', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(105, 25, '식권 준비', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(106, 26, '축의금 정리', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(107, 26, '축의금 명단 정리', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(108, 26, '잔여 식권·식대 정산', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(109, 27, '하객 감사 인사 전달', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(110, 28, '양가 부모님 첫인사', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(111, 28, '상견례 날짜 확정', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(112, 28, '상견례 장소 선택과 예약', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(113, 28, '상견례 교통·숙박 준비', 4, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(114, 28, '상견례 선물 준비', 5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(115, 28, '상견례 진행', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(116, 28, '예식 일정·조건 조율', 7, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(117, 29, '예단 여부 양가 협의', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(118, 29, '예단 전달 날짜 확정', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(119, 30, '폐백 여부 결정', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(120, 30, '이바지 음식 예약', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(121, 30, '폐백 진행', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(122, 31, '한복 대여·맞춤 결정', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(123, 31, '한복 업체 선택', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(124, 31, '혼주 한복 선택과 계약', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(125, 31, '한복 가봉', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(126, 31, '한복 소품 준비', 5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(127, 31, '혼주 예복 준비', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(128, 31, '혼주 드레스·양장 선택', 7, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(129, 31, '혼주 구두·가방 선택', 8, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(130, 31, '혼주 코사지·꽃 준비', 9, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(131, 32, '형제자매 의상 준비', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(132, 32, '조부모 의상 준비', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(133, 32, '조부모 선물 준비', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(134, 33, '출장 메이크업 여부 결정', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(135, 33, '혼주 메이크업 인원 확정', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(136, 33, '혼주 메이크업 예약', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(137, 33, '혼주 헤어 예약', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(138, 34, '가족 대여 물품 반납', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(139, 35, '총예산 수립', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(140, 35, '예비비 편성', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(141, 35, '예식 희망 날짜 범위 결정', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(142, 35, '예식 지역 결정', 4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(143, 35, '현금영수증·소득공제 방식 확인', 5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(144, 36, '웨딩밴드 투어', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(145, 36, '결혼반지 선택', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(146, 36, '웨딩밴드 계약', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(147, 37, '결혼 전 건강검진 여부 결정', 1, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(148, 37, '치아 관리 일정 예약', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(149, 37, '피부 관리 일정 예약', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(150, 37, '헤어·염색 일정 예약', 4, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(151, 37, '네일 일정 예약', 5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(152, 38, '신혼여행지 결정', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(153, 38, '항공권 예약', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(154, 38, '숙소 예약', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(155, 39, '여권 유효기간 확인', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(156, 39, '비자·입국 등록 확인', 2, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(157, 39, '여행자보험 가입', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(158, 39, '해외결제 카드·트래블페이 준비', 4, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(159, 39, '환전·외화 준비', 5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(160, 39, '로밍·eSIM 준비', 6, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(161, 40, '신혼집 후보 조사', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(162, 40, '신혼집 계약', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(163, 40, '인테리어·공사 범위 결정', 3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(164, 41, '혼수 목록 결정', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(165, 41, '가전·가구 계약', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(166, 41, '이사 업체 예약', 3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(167, 42, '신혼집 입주', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(168, 42, '전입신고·확정일자 처리', 2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(169, 43, '혼인신고 접수', 1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
AS new ON DUPLICATE KEY UPDATE
    step_id       = new.step_id,
    title         = new.title,
    display_order = new.display_order,
    essential     = new.essential,
    updated_at    = CURRENT_TIMESTAMP;


-- 명시한 ID 이후부터 자동 증가
ALTER TABLE categories AUTO_INCREMENT = 6;
ALTER TABLE steps AUTO_INCREMENT = 44;
ALTER TABLE catalog_items AUTO_INCREMENT = 170;

-- 데이터 검증
SELECT (SELECT COUNT(*) FROM categories)    AS categories,   -- 5
       (SELECT COUNT(*) FROM steps)         AS steps,        -- 43
       (SELECT COUNT(*) FROM catalog_items) AS catalog_items;-- 169
SELECT COUNT(*) AS steps_without_icon FROM steps WHERE icon_url IS NULL; -- 0
