"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps the active tab of a horizontally-scrolling `.module-nav-bar` in view.
 * On mobile the second-header tab strip scrolls sideways, so the active tab
 * (or one that was just tapped) can sit off-screen. This centres it in the
 * scroll container — instantly on first paint, smoothly on later changes.
 *
 * Returns a ref for the scroll container (`.module-nav-wrap`) and an
 * `onTabClick` handler to centre a tab the moment it's tapped, before the
 * route change lands.
 */
export function useCenterActiveTab(pathname: string | null | undefined) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  const centerElement = useCallback((el: HTMLElement | null, behavior: ScrollBehavior) => {
    const wrap = wrapRef.current;
    if (!wrap || !el) return;
    const wrapRect = wrap.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.left + elRect.width / 2 - (wrapRect.left + wrapRect.width / 2);
    if (Math.abs(delta) < 1) return;
    wrap.scrollBy({ left: delta, behavior });
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const active = wrap.querySelector<HTMLElement>(".module-tab.active");
    centerElement(active, didInitialScroll.current ? "smooth" : "auto");
    didInitialScroll.current = true;
  }, [pathname, centerElement]);

  const onTabClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      centerElement(e.currentTarget, "smooth");
    },
    [centerElement],
  );

  return { wrapRef, onTabClick };
}
