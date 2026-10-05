import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { analytics } from "../../infrastructure/analytics";
import { useAuth } from "../auth";
import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryRequestAbortedError,
  ChecklistQueryModel,
  ChecklistQueryItemModel,
  useChecklistQueryRepository,
  useMyChecklistRevision,
} from "../checklist";
import { getChecklistCategoryItems } from "../checklist/model/checklistQuery";
import { usePreparationChecklistRepository } from "../preparation";
import { createPreparationItemAddEvent } from "../preparation/analytics/preparationAnalytics";
import { ChecklistModalDialog } from "../checklist/view/ChecklistModalDialog";
import { recommendedCatalogItemsRepository } from "./homeDependencies";
import {
  RecommendedCatalogItemsRepository,
  RecommendedCatalogItemsAuthenticationRequiredError,
  RecommendedCatalogItemsRequestAbortedError,
} from "./repository/recommendedCatalogItemsRepository";
import { RecommendedCatalogItemModel } from "./model/recommendedCatalogItem";
import { useRecommendedTaskAddition } from "./useRecommendedTaskAddition";
import { createRecommendedScheduleViewModel } from "./view-model/createRecommendedScheduleViewModel";
import { RecommendedSchedule } from "./view/RecommendedSchedule";
import { MonthlyCalendar } from "./view/MonthlyCalendar";
import { CalendarPlusIcon } from "./view/UnscheduledTask";
import { GuestRecommendedTasksFeature } from "./GuestRecommendedTasksFeature";
import { CalendarDateAssignment } from "./CalendarDateAssignment";
import "./view/CalendarPlanning.css";

export function getLocalDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type LoadState<T> =
  { status: "loading" | "error" } | { status: "complete"; data: T };
type Task = ChecklistQueryItemModel & { category: string };

export function HomeScheduleDashboardFeature({
  getReferenceDate = getLocalDate,
  recommendedRepository = recommendedCatalogItemsRepository,
}: {
  getReferenceDate?: () => string;
  recommendedRepository?: RecommendedCatalogItemsRepository;
}) {
  const { authState, refreshAuth } = useAuth();
  const scope =
    authState.status === "authenticated"
      ? `authenticated:${authState.user.id}`
      : authState.status;
  // A new auth scope unmounts pending requests and clears personal data and drafts.
  return (
    <CalendarPlanning
      key={scope}
      getReferenceDate={getReferenceDate}
      recommendedRepository={recommendedRepository}
      refreshAuth={refreshAuth}
    />
  );
}

function CalendarPlanning({
  getReferenceDate,
  recommendedRepository,
  refreshAuth,
}: {
  getReferenceDate: () => string;
  recommendedRepository: RecommendedCatalogItemsRepository;
  refreshAuth: () => void;
}) {
  const { authState } = useAuth();
  const audience =
    authState.status === "authenticated"
      ? "authenticated"
      : authState.status === "guest"
        ? "guest"
        : undefined;
  const query = useChecklistQueryRepository();
  const revision = useMyChecklistRevision();
  const repository = usePreparationChecklistRepository();
  const [checklist, setChecklist] = useState<LoadState<ChecklistQueryModel>>({
    status: "loading",
  });
  const [recommended, setRecommended] = useState<
    LoadState<RecommendedCatalogItemModel[]>
  >({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [recommendationRevision, setRecommendationRevision] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loginTask, setLoginTask] = useState<Task | null>(null);
  const [focusDate, setFocusDate] = useState<string>();
  const [focusDateRevision, setFocusDateRevision] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const referenceDate = getReferenceDate();
  const refreshChecklist = useCallback(
    () => setReload((value) => value + 1),
    [],
  );

  const retryChecklist = useCallback(() => {
    setChecklist({ status: "loading" });
    refreshChecklist();
  }, [refreshChecklist]);

  useEffect(() => {
    if (!audience) return;
    const controller = new AbortController();
    query.getChecklist(audience, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setChecklist({ status: "complete", data });
      },
      (error) => {
        if (
          controller.signal.aborted ||
          error instanceof ChecklistQueryRequestAbortedError
        )
          return;
        if (error instanceof ChecklistQueryAuthenticationRequiredError)
          refreshAuth();
        setChecklist({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [audience, query, revision, reload, refreshAuth]);

  useEffect(() => {
    if (audience !== "authenticated") return;
    const controller = new AbortController();
    recommendedRepository.getRecommendedCatalogItems(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setRecommended({ status: "complete", data });
      },
      (error) => {
        if (
          controller.signal.aborted ||
          error instanceof RecommendedCatalogItemsRequestAbortedError
        )
          return;
        if (error instanceof RecommendedCatalogItemsAuthenticationRequiredError)
          refreshAuth();
        setRecommended({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [audience, recommendedRepository, recommendationRevision, refreshAuth]);

  const tasks: Task[] =
    checklist.status === "complete"
      ? checklist.data.categories.flatMap((category) =>
          getChecklistCategoryItems(category).map((item) => ({
            ...item,
            category: category.title,
          })),
        )
      : [];
  const undated = tasks.filter(
    (item) => item.status !== "done" && item.appointments.length === 0,
  );
  const schedules = tasks.flatMap((task) =>
    task.appointments.map((appointment) => ({
      ...appointment,
      checklistItemId: task.checklistItemId ?? undefined,
      taskTitle: task.title,
    })),
  );
  const addedIds = new Set(
    tasks.flatMap((task) =>
      task.sourceCatalogItemId === null ? [] : [task.sourceCatalogItemId],
    ),
  );
  const onSuccess = useCallback(
    (catalogItemId: number, itemCount: number) => {
      const item =
        recommended.status === "complete"
          ? recommended.data.find(
              (item) => item.catalogItemId === catalogItemId,
            )
          : undefined;
      if (item) {
        if (itemCount > 0)
          analytics.track(
            createPreparationItemAddEvent({
              categoryName: item.category,
              itemCount,
              phase: item.phase,
              source: "calendar_recommendation",
            }),
          );
      }
      refreshChecklist();
      setRecommendationRevision((value) => value + 1);
    },
    [recommended, refreshChecklist],
  );
  const addition = useRecommendedTaskAddition({
    authScope: audience ?? authState.status,
    isAuthenticated: audience === "authenticated",
    onAuthenticationRequired: refreshAuth,
    onSuccess,
    repository,
  });
  const remainingRecommendations =
    recommended.status === "complete"
      ? recommended.data.filter(
          (item) =>
            !addedIds.has(item.catalogItemId) &&
            !addition.addedCatalogItemIds.includes(item.catalogItemId),
        )
      : [];

  const requestDate = (task: Task) => {
    if (audience === "guest") setLoginTask(task);
    else if (task.checklistItemId !== null) setSelectedTask(task);
  };
  const pendingCatalogId = searchParams.get("dateFor");
  useEffect(() => {
    if (
      audience !== "authenticated" ||
      checklist.status !== "complete" ||
      !pendingCatalogId
    )
      return;
    const task = checklist.data.categories
      .flatMap((category) =>
        getChecklistCategoryItems(category).map((item) => ({
          ...item,
          category: category.title,
        })),
      )
      .find((item) => String(item.sourceCatalogItemId) === pendingCatalogId);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (task && task.checklistItemId !== null) setSelectedTask(task);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("dateFor");
          return next;
        },
        { replace: true },
      );
    });
    return () => {
      active = false;
    };
  }, [audience, checklist, pendingCatalogId, setSearchParams]);
  const closeDate = useCallback(() => setSelectedTask(null), []);
  const onSaved = useCallback(
    (date: string) => {
      setFocusDate(date);
      setFocusDateRevision((value) => value + 1);
      refreshChecklist();
    },
    [refreshChecklist],
  );

  return (
    <section className="calendar-planning" aria-label="내 준비 일정 대시보드">
      <header className="calendar-planning__heading">
        <h1>내 준비 일정</h1>
        <p>필요한 할 일을 담고, 날짜를 정해 준비 일정을 관리해요.</p>
      </header>
      <div className="calendar-planning__layout">
        <div className="calendar-planning__main">
          <MonthlyCalendar
            monthTitleOnly
            referenceDate={referenceDate}
            schedules={schedules}
            focusDate={focusDate}
            focusDateRevision={focusDateRevision}
            schedulesStatus={checklist.status}
          />
          {checklist.status === "loading" && (
            <p className="calendar-planning__loading" role="status">
              내 할 일과 일정을 불러오고 있어요.
            </p>
          )}
          {checklist.status === "error" && (
            <div className="calendar-planning__feedback" role="alert">
              내 할 일과 일정을 불러오지 못했어요.{" "}
              <button onClick={retryChecklist} type="button">
                다시 시도
              </button>
            </div>
          )}
        </div>
        <div className="calendar-planning__side">
          <section
            className="calendar-planning__card"
            aria-labelledby="calendar-undated-title"
          >
            <header>
              <h2 id="calendar-undated-title">
                날짜를 정할 일{" "}
                {checklist.status === "complete" && (
                  <span>{undated.length}개</span>
                )}
              </h2>
              {audience === "guest" && tasks.length === 0 ? (
                <Link to="/login?returnTo=%2Fcalendar">
                  로그인하고 일정 관리하기 ›
                </Link>
              ) : (
                <Link to="/checklist">내 할 일 전체 보기 ›</Link>
              )}
            </header>
            {audience === "guest" &&
            checklist.status === "complete" &&
            tasks.length === 0 ? (
              <div className="calendar-planning__empty">
                <p>
                  로그인하면 담은 할 일에 날짜를 정하고
                  <br />내 준비 일정을 저장할 수 있어요.
                </p>
              </div>
            ) : checklist.status === "loading" ? (
              <div className="calendar-planning__skeleton" aria-busy="true">
                <p role="status">내 할 일을 불러오는 중</p>
              </div>
            ) : checklist.status === "error" ? (
              <p>
                내 할 일을 불러오지 못했어요.{" "}
                <button onClick={retryChecklist} type="button">
                  다시 시도
                </button>
              </p>
            ) : undated.length === 0 ? (
              <div className="calendar-planning__empty">
                <p>날짜를 정할 할 일이 없어요.</p>
                {tasks.length === 0 && (
                  <p>아래 추천에서 필요한 준비를 담아보세요.</p>
                )}
              </div>
            ) : (
              <ul className="calendar-planning__tasks">
                {undated.slice(0, 3).map((task) => (
                  <li key={task.id}>
                    <div>
                      <small>{task.category}</small>
                      <h3>{task.title}</h3>
                    </div>
                    <button type="button" onClick={() => requestDate(task)}>
                      <CalendarPlusIcon />
                      일정 추가
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {undated.length > 3 && (
              <Link to="/checklist">
                나머지 {undated.length - 3}개 전체 보기
              </Link>
            )}
          </section>
          {audience === "guest" ||
          (audience === "authenticated" &&
            checklist.status === "complete" &&
            tasks.length === 0) ? (
            <GuestRecommendedTasksFeature
              audience={audience}
              onAuthenticationRequired={refreshAuth}
              onAdded={refreshChecklist}
            />
          ) : recommended.status === "complete" &&
            checklist.status !== "loading" &&
            remainingRecommendations.length > 0 ? (
            <RecommendedSchedule
              compact
              onAddTask={addition.add}
              viewModel={createRecommendedScheduleViewModel(
                { items: remainingRecommendations },
                addition,
              )}
            />
          ) : (
            <section
              className="calendar-planning__card"
              aria-labelledby="calendar-recommended-title"
            >
              <header>
                <h2 id="calendar-recommended-title">추천 할 일</h2>
                <Link to="/preparation">로드맵 전체 보기 ›</Link>
              </header>
              {recommended.status === "loading" ||
              checklist.status === "loading" ? (
                <div className="calendar-planning__skeleton">
                  <p role="status">추천 할 일을 불러오는 중</p>
                </div>
              ) : recommended.status === "error" ? (
                <p role="alert">
                  추천 대상을 확인하지 못했어요.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setRecommended({ status: "loading" });
                      setRecommendationRevision((value) => value + 1);
                    }}
                  >
                    다시 시도
                  </button>
                </p>
              ) : (
                <p>지금 추가할 추천 항목이 없어요.</p>
              )}
            </section>
          )}
        </div>
      </div>
      {selectedTask?.checklistItemId !== null && selectedTask && (
        <CalendarDateAssignment
          key={selectedTask.checklistItemId}
          itemId={selectedTask.checklistItemId}
          title={selectedTask.title}
          onClose={closeDate}
          onSaved={onSaved}
        />
      )}
      {loginTask && (
        <ChecklistModalDialog
          title="로그인이 필요해요"
          description={
            "일정을 추가하려면 로그인해 주세요.\n로그인 후 캘린더에서 계속할 수 있어요."
          }
          onEscape={() => setLoginTask(null)}
          onBackdropPress={() => setLoginTask(null)}
          actions={
            <>
              <button
                type="button"
                className="checklist-dialog__button"
                onClick={() => setLoginTask(null)}
              >
                취소
              </button>
              <Link
                className="calendar-planning__login-action"
                to={`/login?returnTo=${encodeURIComponent(`/calendar?dateFor=${loginTask.sourceCatalogItemId}`)}`}
              >
                로그인
              </Link>
            </>
          }
        />
      )}
    </section>
  );
}
