import { useCallback, useRef, useState, useEffect } from "react";

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
