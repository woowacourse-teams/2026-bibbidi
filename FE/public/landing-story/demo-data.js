window.BIBBIDI_DEMO_DATA = {
  questions: [
    {
      id: "Q1",
      text: "갑자기 일주일 휴가가 생겼다. 어디로 갈래?",
      options: [
        {
          id: "A",
          text: "아무것도 안 하고 푹 쉬기",
          imageUrl:
            "https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/bibbidi/be/balance-game/question/01_A_beach.webp",
          localImage: "assets/game-first-1.webp",
        },
        {
          id: "B",
          text: "낯선 도시 구석구석 탐험하기",
          imageUrl:
            "https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/bibbidi/be/balance-game/question/01_B_city.webp",
          localImage: "assets/game-first-2.webp",
        },
      ],
    },
    {
      id: "Q5",
      text: "기념일 저녁, 어디로 갈래?",
      options: [
        {
          id: "A",
          text: "기다려도 가고 싶었던 곳",
          imageUrl:
            "https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/bibbidi/be/balance-game/question/05_A_queue.webp",
          localImage: "assets/game-q5-1.webp",
        },
        {
          id: "B",
          text: "바로 앉는 편한 단골집",
          imageUrl:
            "https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/bibbidi/be/balance-game/question/05_B_regular_window.webp",
          localImage: "assets/game-q5-2.webp",
        },
      ],
    },
    {
      id: "Q10",
      text: "월세 50만 원을 더 내면 출퇴근이 2시간에서 20분으로 줄어든다.",
      options: [
        {
          id: "A",
          text: "월세 더 내고 가까이 살기",
          imageUrl:
            "https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/bibbidi/be/balance-game/question/10_A_home_near_work.webp",
          localImage: "assets/game-q10-1.webp",
        },
        {
          id: "B",
          text: "멀어도 월세 아끼기",
          imageUrl:
            "https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/bibbidi/be/balance-game/question/10_B_subway_sleep.webp",
          localImage: "assets/game-q10-2.webp",
        },
      ],
    },
  ],
  result: {
    id: "ALGT",
    name: "편한 게 제일인 사람",
    summary:
      "둘이 편하게 지내는 데 필요한 만큼이면 충분해. 작은 변화에는 유연하고, 믿을 만한 도움을 받아 준비를 간단히 끝내고 싶어.",
    imageUrl:
      "https://techcourse-project-2026.s3.ap-northeast-2.amazonaws.com/bibbidi/be/balance-game/answer/ALGT.webp",
    catalogItemIds: [
      1, 2, 5, 6, 7, 8, 9, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 28,
      29, 30, 34, 35, 36, 39, 40, 41, 42, 43, 44, 45, 47, 48, 49, 50, 52, 53,
      59, 60, 61, 67, 68, 69, 70, 72, 73, 74, 75, 77, 80, 81, 82, 84, 85, 86,
      87, 88, 89, 90, 92, 93, 95, 96, 97, 99, 100, 101, 105, 106, 107, 108, 109,
      110, 111, 112, 114, 115, 116, 117, 118, 122, 123, 124, 125, 127, 136, 137,
      138, 139, 141, 142, 145, 146, 152, 153, 154, 155, 159, 160, 161, 162, 164,
      165, 166, 167, 168, 169, 3, 31, 32, 33, 38, 62, 140, 143, 163,
    ],
  },
  tasks: {
    1: { title: "웨딩홀 투어", step: "웨딩홀 정하기", category: "웨딩홀" },
    2: { title: "웨딩홀 계약", step: "웨딩홀 정하기", category: "웨딩홀" },
    3: {
      title: "예식 형태 결정",
      step: "예식 진행 방식 결정",
      category: "웨딩홀",
    },
    5: { title: "식순 준비", step: "예식 진행 방식 결정", category: "웨딩홀" },
    6: {
      title: "주례·사회자 섭외",
      step: "예식 진행 인원 섭외",
      category: "웨딩홀",
    },
    7: {
      title: "축가·축사·덕담 섭외",
      step: "예식 진행 인원 섭외",
      category: "웨딩홀",
    },
  },
  steps: [
    {
      id: 1,
      name: "웨딩홀 정하기",
      description:
        "마음에 드는 웨딩홀을 직접 둘러보고, 조건을 꼼꼼히 비교해서 한 곳과 계약해요.",
      iconUrl: "https://www.bibbidi.kr/icon/wedding/venue-hall-tour.png",
      displayOrder: 1,
      items: [
        { id: 1, title: "웨딩홀 투어", displayOrder: 1, essential: true },
        { id: 2, title: "웨딩홀 계약", displayOrder: 2, essential: true },
      ],
      localIcon: "assets/roadmap-1.png",
    },
    {
      id: 2,
      name: "예식 진행 방식 결정",
      description:
        "어떤 분위기로 예식을 치를지 정하고, 식순과 입장 방식까지 그려봐요.",
      iconUrl: "https://www.bibbidi.kr/icon/wedding/venue-ceremony-program.png",
      displayOrder: 2,
      items: [
        { id: 3, title: "예식 형태 결정", displayOrder: 1, essential: false },
        { id: 4, title: "입장 방식 결정", displayOrder: 2, essential: false },
        { id: 5, title: "식순 준비", displayOrder: 3, essential: true },
      ],
      localIcon: "assets/roadmap-2.png",
    },
    {
      id: 3,
      name: "예식 진행 인원 섭외",
      description:
        "주례와 사회자, 축가 담당을 구하고 당일 도와줄 사람도 함께 정해요.",
      iconUrl: "https://www.bibbidi.kr/icon/wedding/venue-host-staff.png",
      displayOrder: 3,
      items: [
        { id: 6, title: "주례·사회자 섭외", displayOrder: 1, essential: true },
        {
          id: 7,
          title: "축가·축사·덕담 섭외",
          displayOrder: 2,
          essential: true,
        },
        { id: 8, title: "가방순이 섭외", displayOrder: 3, essential: true },
        { id: 9, title: "부케순이 섭외", displayOrder: 4, essential: true },
        {
          id: 10,
          title: "축의대 담당자 섭외·역할 안내",
          displayOrder: 5,
          essential: false,
        },
        {
          id: 11,
          title: "헬퍼비·사례비 봉투 준비",
          displayOrder: 6,
          essential: false,
        },
      ],
      localIcon: "assets/roadmap-3.png",
    },
    {
      id: 4,
      name: "예식 콘텐츠 준비",
      description:
        "사회자 대본과 성혼선언문을 쓰고, 식전 영상과 본식 음악까지 준비해서 웨딩홀에 전달해요.",
      iconUrl: "https://www.bibbidi.kr/icon/wedding/venue-script-music.png",
      displayOrder: 4,
      items: [
        { id: 12, title: "사회자 대본 준비", displayOrder: 1, essential: true },
        { id: 13, title: "성혼선언문 준비", displayOrder: 2, essential: true },
        { id: 14, title: "혼인서약문 준비", displayOrder: 3, essential: false },
        { id: 15, title: "본식음원 선정", displayOrder: 4, essential: true },
        { id: 16, title: "식전영상 제작", displayOrder: 5, essential: true },
        {
          id: 17,
          title: "식전영상 웨딩홀 전달",
          displayOrder: 6,
          essential: true,
        },
        {
          id: 18,
          title: "본식음원 웨딩홀 전달",
          displayOrder: 7,
          essential: true,
        },
      ],
      localIcon: "assets/roadmap-4.png",
    },
    {
      id: 5,
      name: "본식 촬영 업체 계약",
      description: "소중한 순간을 사진과 영상으로 남겨줄 업체를 찾아 계약해요.",
      iconUrl: "https://www.bibbidi.kr/icon/wedding/venue-videographer.png",
      displayOrder: 5,
      items: [
        { id: 19, title: "본식스냅 계약", displayOrder: 1, essential: true },
        { id: 20, title: "본식DVD 계약", displayOrder: 2, essential: true },
        { id: 21, title: "서브스냅 계약", displayOrder: 3, essential: true },
        { id: 22, title: "아이폰스냅 계약", displayOrder: 4, essential: true },
      ],
      localIcon: "assets/roadmap-5.png",
    },
    {
      id: 6,
      name: "예식 물품 준비",
      description:
        "부케, 접수대 물품처럼 예식장에 놓을 것들과 하객에게 전할 답례품을 챙겨요.",
      iconUrl: "https://www.bibbidi.kr/icon/wedding/venue-supplies-favors.png",
      displayOrder: 6,
      items: [
        {
          id: 23,
          title: "포토부스 설치 여부 결정",
          displayOrder: 1,
          essential: false,
        },
        {
          id: 24,
          title: "답례 대상·수량 정리",
          displayOrder: 2,
          essential: false,
        },
        { id: 25, title: "답례품 준비", displayOrder: 3, essential: true },
        {
          id: 26,
          title: "포토테이블용 사진·액자 준비",
          displayOrder: 4,
          essential: true,
        },
        {
          id: 27,
          title: "식권·식순지·접수대 봉투 준비",
          displayOrder: 5,
          essential: false,
        },
        {
          id: 28,
          title: "부케·부토니아·코사지 예약",
          displayOrder: 6,
          essential: true,
        },
      ],
      localIcon: "assets/roadmap-6.png",
    },
  ],
  categories: ["웨딩홀", "스드메", "초대", "가족", "기타"],
};
