// Hook for tween state
// Usage.
//   const [tweenState, setTweenState] = useTweenState(0, 700);
//   setTweenState(1000); // tweenState gradually changes to 1000 in 700ms
//
// From https://gist.github.com/SevenOutman/438aca96d4cc05f1a81ffe07a98ea99d
//

import { useCallback, useEffect, useRef, useState } from "react";

type EasingFunction = (t: number) => number;

export default function useTweenState(
  initialValue: number,
  duration: number = 400, // ms
  easingFunction: EasingFunction = easeInOutQuad
): [number, (target: number) => void, number, boolean] {
  // State vectors for rerendering react
  const [value, setValue] = useState<number>(initialValue);
  const [target, setTarget] = useState<number>(initialValue);

  // State vectors for inside memoized callbacks
  const startValue = useRef(value); // Start value for the tween
  const currentValue = useRef(value); // Current value for the tween, matches state
  const targetValue = useRef(value); // Target value for the tween

  const startTime = useRef<DOMHighResTimeStamp>(0); // Start time for the tween
  const animateRef = useRef<number>(0); // Ref to the animation handler

  // Callback returned to the customer to change the state
  const setTargetValue = useCallback((target: number) => {
    if (target !== currentValue.current) {
      startValue.current = currentValue.current;
      targetValue.current = target;
      startTime.current = performance.now();

      setTarget(target);
    }
  }, []);

  // Animation callback
  const animate = useCallback(
    (timestamp: DOMHighResTimeStamp) => {
      const dt = timestamp - startTime.current;

      if (dt >= duration) {
        currentValue.current = targetValue.current;

        setValue(currentValue.current);
      } else {
        currentValue.current =
          easingFunction(dt / duration) *
            (targetValue.current - startValue.current) +
          startValue.current;

        setValue(currentValue.current);

        // Schedule a new animation frame
        animateRef.current = requestAnimationFrame(animate);
      }
    },
    [duration, easingFunction]
  );

  // Effect to start the animation
  useEffect(() => {
    if (target !== currentValue.current) {
      animateRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animateRef.current);
    }

    return () => cancelAnimationFrame(animateRef.current);
  }, [animate, target]);

  return [value, setTargetValue, target, value !== target];
}

// @see https://gist.github.com/gre/1650294
export const linear: EasingFunction = (t) => t;
export const easeInQuad: EasingFunction = (t) => t * t;
export const easeOutQuad: EasingFunction = (t) => t * (2 - t);
export const easeInOutQuad: EasingFunction = (t) =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
export const easeInCubic: EasingFunction = (t) => t * t * t;
export const easeOutCubic: EasingFunction = (t) => --t * t * t + 1;
export const easeInOutCubic: EasingFunction = (t) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
export const easeInQuart: EasingFunction = (t) => t * t * t * t;
export const easeOutQuart: EasingFunction = (t) => 1 - --t * t * t * t;
export const easeInOutQuart: EasingFunction = (t) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
export const easeInQuint: EasingFunction = (t) => t * t * t * t * t;
export const easeOutQuint: EasingFunction = (t) => 1 + --t * t * t * t * t;
export const easeInOutQuint: EasingFunction = (t) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
