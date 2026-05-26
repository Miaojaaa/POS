"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchItem = {
  id: string;
  label: string;
  sublabel?: string;
  /** Optional right-side action text (e.g. "+ เพิ่ม"). Falls back to sublabel. */
  trailing?: string;
  /** When false, the row is dimmed and not selectable. */
  disabled?: boolean;
};

type Props = {
  items: SearchItem[];
  value?: string;
  onChange?: (text: string) => void;
  onSelect?: (item: SearchItem) => void;
  placeholder?: string;
  debounceMs?: number;
  maxResults?: number;
  autoFocus?: boolean;
  /** Hide suggestions until the user has typed something. Default: true. */
  requireQuery?: boolean;
  style?: React.CSSProperties;
};

/**
 * Search bar used across the app. Matches the visual language of the
 * chemical / retail search in /pos/new — same input padding, same dropdown
 * shadow, same hover behaviour. See AGENTS.md → "Search bar convention".
 */
export default function SearchInput({
  items,
  value,
  onChange,
  onSelect,
  placeholder = "🔍 ค้นหา...",
  debounceMs = 150,
  maxResults = 8,
  autoFocus,
  requireQuery = true,
  style,
}: Props) {
  const [internal, setInternal] = useState(value ?? "");
  const [debounced, setDebounced] = useState(internal);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value !== undefined && value !== internal) setInternal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(internal), debounceMs);
    return () => clearTimeout(t);
  }, [internal, debounceMs]);

  const suggestions = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (requireQuery && !q) return [] as SearchItem[];
    const matched = q
      ? items.filter(it =>
          it.label.toLowerCase().includes(q) ||
          (it.sublabel || "").toLowerCase().includes(q)
        )
      : items;
    return matched.slice(0, maxResults);
  }, [debounced, items, maxResults, requireQuery]);

  useEffect(() => { setActive(0); }, [debounced]);

  // The pos/new pattern uses onBlur+setTimeout so a click inside the dropdown
  // can still fire before the panel unmounts. Keep that behaviour here.
  const dropdownOpen = focused && suggestions.length > 0;

  function commitText(text: string) {
    setInternal(text);
    onChange?.(text);
  }

  function commitSelect(item: SearchItem) {
    if (item.disabled) return;
    // Update the visible text WITHOUT firing onChange — otherwise callers that
    // clear their bound id inside onChange (e.g. transfers picker) would undo
    // the id we just set via onSelect.
    setInternal(item.label);
    onSelect?.(item);
    setFocused(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitSelect(suggestions[active]);
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative", ...style }}>
      <input
        className="input"
        style={{ marginBottom: 0, paddingLeft: "2rem" }}
        placeholder={placeholder}
        value={internal}
        autoFocus={autoFocus}
        autoComplete="off"
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={e => commitText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {dropdownOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid var(--beige-dark)",
            borderRadius: 8,
            zIndex: 20,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s, i) => {
            const isActive = i === active;
            return (
              <div
                key={s.id}
                onMouseDown={() => commitSelect(s)}
                onMouseEnter={() => setActive(i)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 14px",
                  cursor: s.disabled ? "not-allowed" : "pointer",
                  borderBottom: "1px solid #f0f0f0",
                  fontSize: "0.875rem",
                  background: isActive && !s.disabled ? "var(--beige)" : "white",
                  opacity: s.disabled ? 0.4 : 1,
                }}
              >
                <span>{s.label}</span>
                {(s.trailing || s.sublabel) && (
                  <span style={{ fontSize: "0.8rem", color: s.trailing ? "var(--olive)" : "#666", fontWeight: s.trailing ? 700 : 400 }}>
                    {s.trailing || s.sublabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
