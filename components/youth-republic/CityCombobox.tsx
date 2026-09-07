"use client";

import { useState, useRef, useEffect } from "react";
import { PAKISTAN_CITIES, filterCities, type CityOption } from "@/lib/cities";

interface CityComboboxProps {
  id?: string;
  value: string;
  onChange: (city: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CityCombobox({
  id = "oppLocation",
  value,
  onChange,
  disabled = false,
  placeholder = "Select or search city…",
}: CityComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize internal query state with incoming value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = filterCities(query);

  // Dismiss dropdown on click outside and enforce selection from list
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);

        // Enforce that user cannot add their own custom city
        const trimmed = query.trim().toLowerCase();
        const matched = PAKISTAN_CITIES.find(
          (c) => c.label.toLowerCase() === trimmed || (c.aliases && c.aliases.some((a) => a.toLowerCase() === trimmed))
        );
        if (matched) {
          onChange(matched.label);
          setQuery(matched.label);
        } else {
          // Revert back to value (which is either an existing valid city or empty)
          setQuery(value);
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query, value, onChange]);

  function handleSelect(city: CityOption) {
    onChange(city.label);
    setQuery(city.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsOpen(false);
    setHighlightedIndex(-1);

    const trimmed = query.trim().toLowerCase();
    const matched = PAKISTAN_CITIES.find(
      (c) => c.label.toLowerCase() === trimmed || (c.aliases && c.aliases.some((a) => a.toLowerCase() === trimmed))
    );
    if (matched) {
      onChange(matched.label);
      setQuery(matched.label);
    } else {
      setQuery(value);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    setQuery(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filtered.length - 1);
      } else {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      }
    } else if (e.key === "Enter") {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault();
        handleSelect(filtered[highlightedIndex]);
      } else {
        const trimmed = query.trim().toLowerCase();
        const matched = PAKISTAN_CITIES.find(
          (c) => c.label.toLowerCase() === trimmed || (c.aliases && c.aliases.some((a) => a.toLowerCase() === trimmed))
        );
        if (matched) {
          e.preventDefault();
          handleSelect(matched);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
      setQuery(value);
    }
  }

  if (disabled) {
    return (
      <div className="city-select-wrap">
        <input
          id={id}
          className="form-input bg-[var(--bg-page)] text-[var(--ink-3)] cursor-not-allowed border-[var(--line)]"
          value="N/A"
          readOnly
          disabled
          aria-label="City & Venue (Not applicable for online opportunities)"
        />
      </div>
    );
  }

  return (
    <div className="city-select-wrap" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          className="form-input pr-8"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)] pointer-events-none"
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {isOpen && (
        <div className="city-dropdown" role="listbox">
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-[var(--ink-3)] text-center">
              No matching cities found in list
            </div>
          ) : (
            filtered.map((city, idx) => {
              const isSelected = city.label.toLowerCase() === value.toLowerCase();
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={city.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`city-option ${isSelected ? "selected" : ""} ${isHighlighted ? "active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(city);
                  }}
                  onClick={() => handleSelect(city)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <span className="font-medium text-[var(--ink)]">{city.label}</span>
                  {city.secondary && (
                    <span className="city-option-secondary">{city.secondary}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
