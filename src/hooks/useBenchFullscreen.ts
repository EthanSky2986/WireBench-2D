import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type FullscreenNotice =
  'ui.fullscreen.unavailable' | 'ui.fullscreen.denied' | 'ui.fullscreen.exitFailed';

export interface BenchFullscreenController {
  rootRef: RefObject<HTMLDivElement | null>;
  expanded: boolean;
  toggle: () => Promise<void>;
}

/** Owns only display expansion; fullscreen permission never changes the experiment. */
export function useBenchFullscreen(
  onNotice?: (message: FullscreenNotice) => void,
): BenchFullscreenController {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const desired = useRef(false);
  const nativeOwned = useRef(false);
  const request = useRef(0);
  const mounted = useRef(true);
  const notice = useRef(onNotice);

  useEffect(() => {
    notice.current = onNotice;
  }, [onNotice]);

  const update = useCallback((next: boolean) => {
    desired.current = next;
    if (mounted.current) setExpanded(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const root = rootRef.current;
    const ownerDocument = root?.ownerDocument ?? document;
    const changed = () => {
      if (root && ownerDocument.fullscreenElement === root) {
        nativeOwned.current = true;
      } else if (nativeOwned.current) {
        nativeOwned.current = false;
        request.current += 1;
        update(false);
      }
    };
    const keydown = async (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        (!desired.current && (!root || ownerDocument.fullscreenElement !== root))
      ) {
        return;
      }
      request.current += 1;
      update(false);
      // Some embedded browsers deliver Escape without leaving native fullscreen.
      // Browsers that consume the key still synchronize via fullscreenchange.
      if (root && ownerDocument.fullscreenElement === root) {
        try {
          await ownerDocument.exitFullscreen();
        } catch {
          if (mounted.current && ownerDocument.fullscreenElement === root) {
            update(true);
            notice.current?.('ui.fullscreen.exitFailed');
          }
        }
      }
    };
    ownerDocument.addEventListener('fullscreenchange', changed);
    ownerDocument.addEventListener('keydown', keydown);
    return () => {
      mounted.current = false;
      desired.current = false;
      request.current += 1;
      ownerDocument.removeEventListener('fullscreenchange', changed);
      ownerDocument.removeEventListener('keydown', keydown);
    };
  }, [update]);

  const toggle = useCallback(async () => {
    const root = rootRef.current;
    const ownerDocument = root?.ownerDocument ?? document;
    const operation = ++request.current;
    if (desired.current || (root && ownerDocument.fullscreenElement === root)) {
      update(false);
      if (root && ownerDocument.fullscreenElement === root) {
        try {
          await ownerDocument.exitFullscreen();
        } catch {
          if (mounted.current && ownerDocument.fullscreenElement === root) {
            update(true);
            notice.current?.('ui.fullscreen.exitFailed');
          }
        }
      }
      return;
    }

    update(true);
    if (
      !root ||
      typeof root.requestFullscreen !== 'function' ||
      ownerDocument.fullscreenEnabled === false ||
      (ownerDocument.fullscreenElement && ownerDocument.fullscreenElement !== root)
    ) {
      notice.current?.('ui.fullscreen.unavailable');
      return;
    }

    try {
      await root.requestFullscreen();
    } catch {
      if (mounted.current && desired.current && request.current === operation) {
        notice.current?.('ui.fullscreen.denied');
      }
      return;
    }

    // An Escape, second click, or unmount may precede the permission response.
    if ((!mounted.current || !desired.current) && ownerDocument.fullscreenElement === root) {
      try {
        await ownerDocument.exitFullscreen();
      } catch {
        if (mounted.current && ownerDocument.fullscreenElement === root) {
          update(true);
          notice.current?.('ui.fullscreen.exitFailed');
        }
      }
    }
  }, [update]);

  return { rootRef, expanded, toggle };
}
