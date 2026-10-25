import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from "react";
import { ChevronDown } from "../icons/Chevron";
import { CheckIcon as Check } from "../icons/ActionIcons";
import "./Select.css";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  prefix?: ReactNode;
  group?: string;
  disabled?: boolean;
};
export type SelectSize = "medium" | "large";
type BaseProps = {
  options: SelectOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnSelect?: boolean;
  labelHidden?: boolean;
  listLabel?: string;
  variant?: "box" | "inline";
  label: string;
  placeholder?: string;
  description?: string;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  loading?: boolean;
  readOnly?: boolean;
  required?: boolean;
  size?: SelectSize;
  prefix?: ReactNode;
  name?: string;
  form?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
  onBlur?: () => void;
};
export type SelectProps = BaseProps &
  (
    | {
        multiple?: false;
        value?: string;
        defaultValue?: string;
        onChange?: (value: string) => void;
      }
    | {
        multiple: true;
        value?: string[];
        defaultValue?: string[];
        onChange?: (value: string[]) => void;
      }
  );

export function Select(props: SelectProps) {
  const {
    options: inputOptions,
    open: controlledOpen,
    onOpenChange,
    label,
    placeholder = "선택해주세요",
    description,
    error,
    invalid = false,
    disabled = false,
    loading = false,
    readOnly = false,
    required = false,
    size = "large",
    prefix,
    name,
    form,
    className,
    style,
    ref,
  } = props;
  const groups = [...new Set(inputOptions.map((option) => option.group))];
  const options = groups.flatMap((group) =>
    inputOptions.filter((option) => option.group === group),
  );
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const [internal, setInternal] = useState<string | string[]>(
    props.defaultValue ?? (props.multiple ? [] : ""),
  );
  const selected = props.value ?? internal;
  const values = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];
  const chosen = options.filter((option) => values.includes(option.value));
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );
  const [active, setActive] = useState(-1);
  const [validationError, setValidationError] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const search = useRef({ text: "", time: 0 });
  const isOpen = open && !disabled && !readOnly;
  const isInvalid =
    invalid || !!error || (validationError && chosen.length === 0);
  const message =
    error ||
    (validationError && chosen.length === 0
      ? "항목을 선택해주세요."
      : description);
  const enabled = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index >= 0);
  const activeIndex = enabled.includes(active) ? active : (enabled[0] ?? -1);

  useEffect(() => {
    const ownerForm = native.current?.form;
    if (!ownerForm) return;
    const reset = (event: Event) =>
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        if (props.value === undefined)
          setInternal(props.defaultValue ?? (props.multiple ? [] : ""));
        setValidationError(false);
        setOpen(false);
      });
    ownerForm.addEventListener("reset", reset);
    return () => ownerForm.removeEventListener("reset", reset);
  });

  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isOpen, setOpen]);

  useLayoutEffect(() => {
    if (isOpen) trigger.current?.focus({ preventScroll: true });
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const popup = panel.current;
    if (popup && !popup.matches(":popover-open")) popup.showPopover();
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const up =
        below < Math.min(panel.current?.scrollHeight ?? 320, 320) &&
        above > below;
      const width = Math.min(
        props.variant === "inline" ? Math.max(180, rect.width) : rect.width,
        window.innerWidth - 16,
      );
      setPosition({
        position: "fixed",
        width,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        maxHeight: Math.max(0, Math.min(320, up ? above : below)),
        ...(up
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      });
    };
    place();
    window.addEventListener("resize", place);
    const onScroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) place();
    };
    window.addEventListener("scroll", onScroll, true);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(place);
    observer?.observe(trigger.current!);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
      observer?.disconnect();
      if (popup?.matches(":popover-open")) popup.hidePopover();
    };
  }, [isOpen, props.variant]);

  useLayoutEffect(() => {
    if (!isOpen || activeIndex < 0 || !panel.current) return;
    const item = document.getElementById(`${id}-option-${activeIndex}`);
    if (!item) return;
    // Scroll only the list; scrollIntoView can move the document before portal placement.
    const listRect = panel.current.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    if (itemRect.top < listRect.top + 6)
      panel.current.scrollTop -= listRect.top + 6 - itemRect.top;
    else if (itemRect.bottom > listRect.bottom - 6)
      panel.current.scrollTop += itemRect.bottom - listRect.bottom + 6;
  }, [isOpen, activeIndex, id, position]);

  function show(last = false) {
    if (disabled || loading || readOnly) return;
    const current = enabled.find((index) =>
      values.includes(options[index].value),
    );
    setActive(current ?? (last ? enabled.at(-1) : enabled[0]) ?? -1);
    search.current = { text: "", time: 0 };
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled || disabled || loading || readOnly) return;
    if (props.multiple) {
      const next = values.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...values, option.value];
      if (props.value === undefined) setInternal(next);
      props.onChange?.(next);
    } else {
      if (props.value === undefined) setInternal(option.value);
      if (!values.includes(option.value)) props.onChange?.(option.value);
      if (values.includes(option.value) || props.closeOnSelect !== false)
        setOpen(false);
    }
    trigger.current?.focus({ preventScroll: true });
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || loading || readOnly || event.nativeEvent.isComposing)
      return;
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (
      ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)
    ) {
      event.preventDefault();
      if (!isOpen) {
        show(event.key === "ArrowUp" || event.key === "End");
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        choose(activeIndex);
        return;
      }
      const offset = event.key === "ArrowUp" ? -1 : 1;
      const next =
        event.key === "Home"
          ? enabled[0]
          : event.key === "End"
            ? enabled.at(-1)
            : enabled[
                (enabled.indexOf(activeIndex) + offset + enabled.length) %
                  enabled.length
              ];
      setActive(next ?? -1);
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const text =
        (Date.now() - search.current.time < 700 ? search.current.text : "") +
        event.key.toLocaleLowerCase();
      search.current = { text, time: Date.now() };
      const query = [...text].every((char) => char === text[0])
        ? text[0]
        : text;
      const start = enabled.indexOf(activeIndex);
      const ordered = [
        ...enabled.slice(start + 1),
        ...enabled.slice(0, start + 1),
      ];
      const match = ordered.find((index) =>
        options[index].label.toLocaleLowerCase().startsWith(query),
      );
      if (!isOpen) show();
      if (match !== undefined) setActive(match);
    }
  }
  const summary =
    chosen.length > 1
      ? `${chosen[0].label} 외 ${chosen.length - 1}개`
      : chosen[0]?.label;
  return (
    <div
      className={["bibbidi-select", className].filter(Boolean).join(" ")}
      style={style}
      data-size={size}
      data-variant={props.variant ?? "box"}
      data-disabled={disabled || undefined}
    >
      <label
        className="bibbidi-select-label"
        id={`${id}-label`}
        htmlFor={id}
        data-hidden={props.labelHidden || undefined}
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <button
        ref={(element) => {
          trigger.current = element;
          if (typeof ref === "function") return ref(element);
          if (ref) ref.current = element;
        }}
        id={id}
        type="button"
        role="combobox"
        className="bibbidi-select-trigger"
        disabled={disabled}
        aria-disabled={disabled || loading || undefined}
        aria-busy={loading || undefined}
        aria-labelledby={`${id}-label`}
        aria-describedby={message ? `${id}-message` : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? `${id}-list` : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
        }
        aria-required={required || undefined}
        aria-invalid={isInvalid || undefined}
        aria-readonly={readOnly || undefined}
        data-open={isOpen || undefined}
        data-invalid={isInvalid || undefined}
        data-readonly={readOnly || undefined}
        onClick={() => {
          if (!loading) {
            if (isOpen) setOpen(false);
            else show();
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          props.onBlur?.();
        }}
      >
        {prefix && (
          <span className="bibbidi-select-prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <span
          className="bibbidi-select-value"
          data-placeholder={!summary || undefined}
          title={chosen.map((option) => option.label).join(", ")}
        >
          {summary || placeholder}
        </span>
        <ChevronDown
          className="bibbidi-select-chevron"
          width={18}
          height={18}
          aria-hidden="true"
        />
      </button>
      {message && (
        <p
          className="bibbidi-select-message"
          id={`${id}-message`}
          data-error={isInvalid || undefined}
          role={error ? "alert" : undefined}
        >
          {message}
        </p>
      )}
      <select
        ref={native}
        className="bibbidi-select-native"
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        form={form}
        multiple={props.multiple}
        value={props.multiple ? values : (values[0] ?? "")}
        disabled={disabled}
        required={required && !readOnly}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setValidationError(true);
          trigger.current?.focus();
        }}
      >
        {!props.multiple && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {isOpen && (
        <div
          ref={panel}
          popover="manual"
          id={`${id}-list`}
          role="listbox"
          aria-label={props.listLabel}
          aria-labelledby={props.listLabel ? undefined : `${id}-label`}
          aria-multiselectable={props.multiple || undefined}
          className="bibbidi-select-list"
          data-size={size}
          style={position}
          onPointerDown={(event) => event.preventDefault()}
        >
          {options.length === 0 && (
            <div className="bibbidi-select-empty" role="presentation">
              선택 가능한 항목이 없어요.
            </div>
          )}
          {groups.map((group, groupIndex) => (
            <div
              key={group ?? "__ungrouped"}
              role="group"
              aria-labelledby={group ? `${id}-group-${groupIndex}` : undefined}
            >
              {group && (
                <div
                  className="bibbidi-select-group-label"
                  id={`${id}-group-${groupIndex}`}
                >
                  {group}
                </div>
              )}
              {options.map((option, index) =>
                option.group !== group ? null : (
                  <button
                    type="button"
                    tabIndex={-1}
                    key={option.value}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={values.includes(option.value)}
                    aria-disabled={option.disabled || loading || undefined}
                    aria-labelledby={`${id}-option-label-${index}`}
                    aria-describedby={
                      option.description
                        ? `${id}-option-description-${index}`
                        : undefined
                    }
                    className="bibbidi-select-option"
                    data-active={activeIndex === index || undefined}
                    onPointerMove={() => {
                      if (!option.disabled) setActive(index);
                    }}
                    onClick={() => choose(index)}
                  >
                    {option.prefix && (
                      <span
                        className="bibbidi-select-prefix"
                        aria-hidden="true"
                      >
                        {option.prefix}
                      </span>
                    )}
                    <span className="bibbidi-select-option-body">
                      <span id={`${id}-option-label-${index}`}>
                        {option.label}
                      </span>
                      {option.description && (
                        <span
                          className="bibbidi-select-option-description"
                          id={`${id}-option-description-${index}`}
                        >
                          {option.description}
                        </span>
                      )}
                    </span>
                    <span className="bibbidi-select-check" aria-hidden="true">
                      {values.includes(option.value) && (
                        <Check width={17} height={17} />
                      )}
                    </span>
                  </button>
                ),
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
