(() => {
  "use strict";
  const data = window.BIBBIDI_DEMO_DATA;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let scrollOwner = null;
  let previousScrollY = window.scrollY;
  let scrollingDown = true;
  window.addEventListener(
    "scroll",
    () => {
      scrollingDown = window.scrollY >= previousScrollY;
      previousScrollY = window.scrollY;
    },
    { passive: true },
  );

  function releaseScroll() {
    if (!scrollOwner) return;
    scrollOwner.dataset.scrollHeld = "false";
    scrollOwner = null;
    document.documentElement.classList.remove("demo-scroll-held");
  }

  // Keep an exit available through the toolbar, upward scroll, Escape and navigation.
  window.addEventListener(
    "wheel",
    (event) => {
      if (!scrollOwner || event.ctrlKey || !event.deltaY) return;
      if (event.deltaY < 0) releaseScroll();
      else event.preventDefault();
    },
    { passive: false },
  );
  let touchY = null;
  window.addEventListener(
    "touchstart",
    (event) => {
      touchY = event.touches[0]?.clientY ?? null;
    },
    { passive: true },
  );
  window.addEventListener(
    "touchmove",
    (event) => {
      if (!scrollOwner || touchY === null || event.touches.length !== 1) return;
      const nextY = event.touches[0].clientY;
      if (nextY > touchY) releaseScroll();
      else if (nextY < touchY) event.preventDefault();
      touchY = nextY;
    },
    { passive: false },
  );
  document.addEventListener("keydown", (event) => {
    if (!scrollOwner) return;
    if (["Escape", "ArrowUp", "PageUp", "Home"].includes(event.key))
      releaseScroll();
    else if (
      ["ArrowDown", "PageDown", "End", " "].includes(event.key) &&
      !event.target.closest(
        "button, a, input, textarea, select, [contenteditable]",
      )
    ) {
      event.preventDefault();
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("a[href]")) releaseScroll();
  });
  window.addEventListener("hashchange", releaseScroll);
  window.addEventListener("resize", releaseScroll);

  // A small timed sequence keeps the demos independent of network and account state.
  // There is no render loop: off-screen and hidden-tab players have no running timer.
  const sequences = {
    overview: [
      { duration: 2200, status: "전체 준비 흐름을 확인해요", follow: 0 },
      {
        duration: 2300,
        status: "필요한 준비 3개를 내 목록에 담았어요",
        follow: 0,
      },
      { duration: 1900, status: "웨딩홀 투어를 완료해요", follow: 1 },
      { duration: 2100, status: "1개 완료 · 2개 남음", follow: 1 },
      { duration: 2000, status: "다음 준비는 웨딩홀 계약이에요", follow: 2 },
      {
        duration: 0,
        status: "얼마나 했는지, 무엇이 남았는지 한눈에.",
        follow: 2,
      },
    ],
    chat: [
      { duration: 1900, status: "내 상황부터 이야기해요", follow: 0 },
      { duration: 2400, status: "궁금한 내용을 입력해요", follow: 0 },
      { duration: 700, status: "상황을 전했어요", follow: 0 },
      { duration: 1300, status: "준비 정보를 확인해요", follow: 1 },
      {
        duration: 2200,
        status: "우리 상황에 맞는 준비를 안내받아요",
        follow: 1,
      },
      { duration: 2300, status: "추천 3개 중 필요한 준비를 골라요", follow: 1 },
      { duration: 1500, status: "예식 형태 결정을 선택해요", follow: 1 },
      { duration: 1900, status: "2개 선택 · 1개 선택 안 함", follow: 1 },
      { duration: 1600, status: "선택한 2개만 내 체크리스트로", follow: 2 },
      {
        duration: 2400,
        status: "왼쪽 준비 목록에 2개가 추가됐어요",
        follow: 2,
      },
      {
        duration: 0,
        status: "선택한 준비는 담고, 나머지는 남겨둬요.",
        follow: 2,
      },
    ],
    game: [
      { duration: 2300, status: "10가지 질문 중 1번", follow: 0 },
      { duration: 1100, status: "평소 취향대로 선택해요", follow: 0 },
      { duration: 2400, status: "질문 과정을 요약했어요 · 5번", follow: 0 },
      { duration: 1100, status: "어떤 선택이 우리다울까요?", follow: 0 },
      { duration: 2500, status: "마지막 질문 · 10번", follow: 0 },
      { duration: 1100, status: "10가지 선택으로 결과를 확인해요", follow: 0 },
      { duration: 3400, status: "우리의 결혼 준비 유형이에요", follow: 1 },
      { duration: 2700, status: "추천된 준비 목록을 확인해요", follow: 2 },
      { duration: 1500, status: "추천 중 필요한 3개를 선택해요", follow: 2 },
      { duration: 1500, status: "로그인 후 선택한 할 일을 담아요", follow: 2 },
      { duration: 0, status: "맞춤 체크리스트로 시작해요", follow: 2 },
    ],
  };

  function renderOverview(root, step) {
    const view = step === 0 ? "roadmap" : "checklist";
    root.querySelectorAll("[data-overview-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.overviewPanel !== view;
    });
    root.querySelector(".service-frame").dataset.view = view;
    const completed = step >= 2;
    const rows = root.querySelectorAll(".product-task");
    rows[0].classList.toggle("done", completed);
    rows[0].querySelector(".small-check").textContent = completed ? "✓" : "";
    rows[0].querySelector("b").textContent = completed ? "완료" : "예정";
    rows[1].classList.toggle("is-next", step >= 4);
    root.querySelector(".overview-completed").textContent = completed
      ? "1"
      : "0";
    root.querySelector(".overview-remaining").textContent = completed
      ? "2"
      : "3";
    const activeCategory = root.querySelector(
      '[data-overview-panel="checklist"] .category-tabs .active',
    );
    activeCategory.innerHTML = `웨딩홀 <small>${completed ? 1 : 0}/3</small>`;
    root.querySelector(".checklist-stage-head > span").textContent = completed
      ? "1/2 완료"
      : "0/2 완료";
    root.querySelector(".product-track i").style.width = completed
      ? "50%"
      : "0%";
  }

  function renderChat(root, step) {
    const parts = {
      welcome: step < 2,
      question: step >= 2 && step < 9,
      thinking: step === 3,
      answer: step >= 4,
      cards: step >= 5,
      saved: step >= 9,
    };
    root.querySelectorAll("[data-chat-part]").forEach((part) => {
      part.hidden = !parts[part.dataset.chatPart];
    });
    root.querySelector(".chat-log").hidden = step < 2;
    root.querySelector(".composer-placeholder").hidden = step === 1;
    root.querySelector(".composer-draft").hidden = step !== 1;
    const count = step >= 7 ? 2 : step === 6 ? 1 : 0;
    root.querySelector(".chat-selection-count").textContent = `${count}개 선택`;
    root.querySelectorAll(".chat-task").forEach((task, index) => {
      const selected = index < count;
      task.classList.toggle("is-selected", selected);
      task.setAttribute(
        "aria-label",
        `${task.querySelector("strong").textContent} · ${selected ? "선택함" : "선택 안 함"}`,
      );
    });
    root.querySelector(".chat-actions > strong").textContent =
      step >= 9 ? "추가 완료" : count ? `${count}개 추가` : "추가";
    root.querySelectorAll("[data-chat-added]").forEach((group) => {
      group.hidden = step < 9;
    });
    root.querySelector(".chat-list-total").textContent = step >= 9 ? "4" : "2";
    root.querySelector(
      ".chat-checklist .category-tabs .active small",
    ).textContent = step >= 9 ? "2/4" : "2/2";
    root.querySelector(".checklist-ready-note").hidden = step >= 9;
    root.querySelector(".checklist-added-note").hidden = step < 9;
    root.querySelector(".selected-legend b").textContent = String(count);
    root.querySelector(".unselected-legend b").textContent = String(3 - count);
    root.querySelector(".legend-result").textContent =
      step >= 9
        ? "선택한 2개가 내 체크리스트에 담겼어요."
        : "추천 중 필요한 준비만 골라요.";
    const body = root.querySelector(".chat-ui-content");
    body.scrollTop = step >= 5 ? body.scrollHeight : 0;
  }

  function renderGame(root, step) {
    const screen =
      step <= 5
        ? "question"
        : step === 6
          ? "result"
          : step <= 9
            ? "recommendations"
            : "saved";
    root.querySelectorAll("[data-game-screen]").forEach((panel) => {
      panel.hidden = panel.dataset.gameScreen !== screen;
    });
    if (step <= 5) {
      const question = data.questions[Math.floor(step / 2)];
      root.querySelector(".question-number").textContent = String(
        Number(question.id.slice(1)),
      ).padStart(2, "0");
      root.querySelector(".game-progress i").style.width =
        `${Number(question.id.slice(1)) * 10}%`;
      root.querySelector(".game-question").textContent = question.text;
      root.querySelectorAll(".game-option").forEach((option, index) => {
        const item = question.options[index];
        const img = option.querySelector("img");
        if (img.getAttribute("src") !== item.localImage)
          img.setAttribute("src", item.localImage);
        option.querySelector("strong").textContent = item.text;
        option.classList.toggle("selected", index === 0 && step % 2 === 1);
      });
    }
    const selected = step === 8 || step === 9;
    root.querySelector(".game-selection-count").textContent =
      `${selected ? 3 : 0}개 선택 · 0개 이미 담음`;
    root.querySelector(".game-save").textContent = selected
      ? "로그인하고 3개 할 일 담기"
      : "할 일을 선택해 주세요";
  }

  function createPlayer(root) {
    const stage = root.closest(".feature-layout");
    const type = root.dataset.player;
    const sequence = sequences[type];
    const toggle = root.querySelector('[data-action="toggle"]');
    const replay = root.querySelector('[data-action="replay"]');
    const scrollGuide = document.createElement("div");
    scrollGuide.className = "demo-scroll-guide";
    scrollGuide.innerHTML =
      '<span>시연이 끝나면 다시 스크롤할 수 있어요.</span><button type="button">시연 넘기기 <span aria-hidden="true">↓</span></button>';
    root.append(scrollGuide);
    const skip = scrollGuide.querySelector("button");
    const label = {
      overview: "준비 현황 예시",
      chat: "AI 상담 예시",
      game: "결혼 취향 예시",
    }[type];
    const follow = document.querySelector(`[data-follow="${type}"]`);
    let step = reducedMotion.matches ? sequence.length - 1 : 0;
    let wantsToPlay = !reducedMotion.matches;
    let visible = false;
    let timer = null;
    let startedAt = 0;
    let remaining = sequence[step].duration;
    let ended = reducedMotion.matches;
    let hasHeldScroll = false;
    let firstPlaybackComplete = reducedMotion.matches;

    function firstPassRequired() {
      return type === "overview" && !firstPlaybackComplete;
    }

    function viewingFrame() {
      const rect = stage.getBoundingClientRect();
      const headerBottom = document
        .querySelector(".site-header")
        .getBoundingClientRect().bottom;
      const availableHeight = window.innerHeight - headerBottom - 32;
      return {
        rect,
        fits: rect.height <= availableHeight,
        top:
          headerBottom + 16 + Math.max(0, (availableHeight - rect.height) / 2),
      };
    }

    function holdWhenReady() {
      if (
        scrollOwner ||
        (hasHeldScroll && !firstPassRequired()) ||
        (!timer && !firstPassRequired()) ||
        !visible ||
        reducedMotion.matches ||
        !scrollingDown
      )
        return;
      const { rect, top, fits } = viewingFrame();
      // The explanation, demo and exit must all be visible before holding the page.
      if (!rect.height || !fits) return;
      if (
        rect.top > top + 2 ||
        rect.bottom <= top + Math.min(rect.height / 2, 120)
      )
        return;
      hasHeldScroll = true;
      scrollOwner = root;
      root.dataset.scrollHeld = "true";
      window.scrollTo({
        top: window.scrollY + rect.top - top,
        behavior: "instant",
      });
      previousScrollY = window.scrollY;
      document.documentElement.classList.add("demo-scroll-held");
    }

    function updateControls() {
      const running = Boolean(timer);
      root.dataset.playing = String(running);
      root.dataset.ended = String(ended);
      root.dataset.firstPlaybackComplete = String(firstPlaybackComplete);
      skip.disabled = firstPassRequired();
      skip.innerHTML = firstPassRequired()
        ? "첫 재생 완료 후 이동 가능"
        : '시연 넘기기 <span aria-hidden="true">↓</span>';
      scrollGuide.querySelector(":scope > span").textContent =
        firstPassRequired()
          ? "위로는 이동할 수 있어요. 아래로는 첫 시연이 끝난 뒤에."
          : "시연이 끝나면 다시 스크롤할 수 있어요.";
      if (
        (ended ||
          (!wantsToPlay && !firstPassRequired()) ||
          !visible ||
          document.hidden) &&
        scrollOwner === root
      )
        releaseScroll();
      toggle.querySelector(".toggle-icon").textContent = ended
        ? "▶"
        : wantsToPlay
          ? "Ⅱ"
          : "▶";
      toggle.querySelector(".toggle-label").textContent = ended
        ? "재생"
        : wantsToPlay
          ? "일시정지"
          : "재생";
      toggle.setAttribute(
        "aria-label",
        `${label} ${ended || !wantsToPlay ? "재생" : "일시정지"}`,
      );
      root.querySelector(".player-status").textContent = sequence[step].status;
    }

    function render() {
      root.dataset.step = String(step);
      root.dataset.enter = "true";
      if (type === "overview") renderOverview(root, step);
      else if (type === "chat") renderChat(root, step);
      else renderGame(root, step);
      follow.querySelectorAll("li").forEach((item, index) => {
        if (index === sequence[step].follow)
          item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      });
      updateControls();
    }

    function stopTimer() {
      if (timer !== null) {
        window.clearTimeout(timer);
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
        timer = null;
      }
    }

    function schedule() {
      if (
        timer !== null ||
        !wantsToPlay ||
        !visible ||
        document.hidden ||
        ended
      ) {
        updateControls();
        return;
      }
      // Start the full sequence when it reaches the viewing position, not at the screen edge.
      const { rect, top, fits } = viewingFrame();
      if (!hasHeldScroll && rect.height && fits && rect.top > top + 2) {
        updateControls();
        return;
      }
      startedAt = performance.now();
      timer = window.setTimeout(() => {
        timer = null;
        step += 1;
        remaining = sequence[step].duration;
        ended = step === sequence.length - 1;
        if (ended) firstPlaybackComplete = true;
        if (ended) wantsToPlay = false;
        render();
        schedule();
      }, remaining);
      updateControls();
      holdWhenReady();
    }

    function restart() {
      stopTimer();
      step = 0;
      remaining = sequence[0].duration;
      ended = false;
      wantsToPlay = true;
      render();
      schedule();
    }

    toggle.addEventListener("click", () => {
      if (ended) {
        restart();
        return;
      }
      wantsToPlay = !wantsToPlay;
      if (!wantsToPlay) stopTimer();
      schedule();
    });
    replay.addEventListener("click", restart);
    skip.addEventListener("click", () => {
      if (firstPassRequired()) return;
      stopTimer();
      hasHeldScroll = true;
      wantsToPlay = false;
      ended = true;
      firstPlaybackComplete = true;
      step = sequence.length - 1;
      remaining = 0;
      render();
      root
        .closest("section")
        .nextElementSibling?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
    window.addEventListener(
      "scroll",
      () => {
        if (scrollingDown) {
          schedule();
          holdWhenReady();
        }
      },
      { passive: true },
    );
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopTimer();
      schedule();
    });
    reducedMotion.addEventListener("change", (event) => {
      if (!event.matches) return;
      stopTimer();
      wantsToPlay = false;
      ended = true;
      firstPlaybackComplete = true;
      step = sequence.length - 1;
      remaining = 0;
      render();
    });
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (!visible) stopTimer();
        schedule();
      },
      { threshold: 0.4 },
    );
    observer.observe(root);
    render();
  }

  if (data && "IntersectionObserver" in window) {
    document.querySelectorAll("[data-player]").forEach(createPlayer);
  }
})();
