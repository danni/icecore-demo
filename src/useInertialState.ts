/*
 * useInertialState
 *
 * A hook to add inertia to a state change.
 *
 * Copyright 2021 Danielle Madeley <danielle@madeley.id.au>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { useCallback, useRef, useState, useEffect } from "react";

/**
 * Add inertial to a state value.
 *
 * Updates are done in an animation frame.
 * Use target value when updating the target in flight.
 *
 * ```
 * const [currentValue, setTargetValue, targetValue] = useInertialState(0);
 *
 * setTargetValue(targetValue + delta)
 * ```
 *
 * @param initialValue value to initialise state with
 * @param zeta damping factor
 * @param threshold velocity threshold to stop animation
 * @returns Returns a tuple of the current value, the setter, and the target value
 */
export default function useInertialState(
  initialValue: number,
  zeta: number = 10, // damping factor
  threshold: number = 1 // damping threshold
): [number, (target: number) => void, number] {
  // State tracking for the caller
  const [value, setValue] = useState<number>(initialValue);
  const [target, _setTarget] = useState<number>(initialValue);

  // Refs to our own values we can access in memoized callbacks
  const previousValue = useRef<number>(initialValue);
  const previousTimestamp = useRef<DOMHighResTimeStamp>(0);
  const targetValue = useRef<number>(initialValue);
  const velocity = useRef<number>(0);
  const animateRef = useRef<number>(0);

  // Wrapper to set all values at once
  const setTarget = useCallback((value: number) => {
    targetValue.current = value;
    _setTarget(value);
  }, []);

  // inertial movement of the value
  // This will keep retriggering until we hit the dampening threshold
  // or new manual forcing takes over the animateRef
  const inertial = useCallback(
    (timestamp: DOMHighResTimeStamp) => {
      const dt = (timestamp - previousTimestamp.current) / 1000;

      // Dampen the velocity
      velocity.current -= velocity.current * zeta * dt;

      // Calculate the next value
      const next = Math.round(targetValue.current + velocity.current * dt);

      previousValue.current = targetValue.current;
      previousTimestamp.current = timestamp;

      setValue(next);
      setTarget(next);

      // If we're still above the dampening threshold, schedule another animation
      // frame
      if (Math.abs(velocity.current) > threshold) {
        animateRef.current = requestAnimationFrame(inertial);
      } else {
        velocity.current = 0;
      }
    },
    [setValue, setTarget, zeta, threshold]
  );

  // manual forcing of the value, e.g. on mouse move
  // (done as an animation callback to throttle the UI)
  const manualForcing = useCallback(
    (timestamp: DOMHighResTimeStamp) => {
      // Calculate the velocity between this frame and the last
      const dt = (timestamp - previousTimestamp.current) / 1000;
      velocity.current = (targetValue.current - previousValue.current) / dt;

      previousValue.current = targetValue.current;
      previousTimestamp.current = timestamp;

      // Update the React state with this value
      setValue(targetValue.current);

      // Request an inertial animation
      animateRef.current = requestAnimationFrame(inertial);
    },
    [inertial]
  );

  // Cancel any animation on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(animateRef.current);
  }, []);

  // State setter returned to the caller
  const setManualForcing = useCallback(
    (value: number) => {
      setTarget(value); // Track this for the caller

      // Request the state updated in an animation frame to throttle the
      // update rate
      cancelAnimationFrame(animateRef.current);
      animateRef.current = requestAnimationFrame(manualForcing);
    },
    [setTarget, manualForcing]
  );

  return [value, setManualForcing, target];
}
