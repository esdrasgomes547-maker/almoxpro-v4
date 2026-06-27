import { useEffect, useState } from "react";

export type PerformanceMode = "auto" | "high" | "pocket";

export function getDeviceCapabilities() {
  if (typeof window === "undefined") return { isLowEnd: false, reason: "ssr" };

  // 1. Check user choice for reduced motion
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return { isLowEnd: true, reason: "user_preference" };

  const nav = navigator as any;

  // 2. Memory check (Devices with 3GB RAM or less are considered low end for modern animations)
  if (nav.deviceMemory && nav.deviceMemory <= 3) {
    return { isLowEnd: true, reason: `low_memory_${nav.deviceMemory}gb` };
  }

  // 3. CPU cores check (Dual core or single core are legacy, quad-core with low memory can be too)
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) {
    return { isLowEnd: true, reason: `low_cpu_cores_${nav.hardwareConcurrency}` };
  }

  // 4. Heavy GPU capability detection for older iOS/Android devices
  const ua = navigator.userAgent;
  const isOlderMobile = /iPhone|iPad|iPod/i.test(ua) && !/OS (15|16|17|18|19|20)/i.test(ua);
  if (isOlderMobile) {
    // Older iPhones/iPads default to pocket mode for absolute layout speed
    return { isLowEnd: true, reason: "older_ios_device" };
  }

  return { isLowEnd: false, reason: "modern_device" };
}

// Global state or simple local storage syncing
export function usePerformance() {
  const [mode, setModeState] = useState<PerformanceMode>(() => {
    const saved = localStorage.getItem("almox_perf_mode");
    return (saved as PerformanceMode) || "auto";
  });

  const [activePreset, setActivePreset] = useState<"high" | "pocket">("high");

  useEffect(() => {
    if (mode === "auto") {
      const { isLowEnd } = getDeviceCapabilities();
      setActivePreset(isLowEnd ? "pocket" : "high");
    } else {
      setActivePreset(mode === "pocket" ? "pocket" : "high");
    }
  }, [mode]);

  // Framerate tracker for real-time lag prevention!
  useEffect(() => {
    if (mode !== "auto") return;

    const { isLowEnd } = getDeviceCapabilities();
    const fpsHistory: number[] = [];
    const maxHistoryLength = 5; // 5 seconds of historical samples for a reliable moving average

    let frameCount = 0;
    let sampleStartTime = performance.now();
    let rafId: number;

    const measure = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - sampleStartTime;

      if (elapsed >= 1000) {
        const currentFps = (frameCount * 1000) / elapsed;
        fpsHistory.push(currentFps);
        if (fpsHistory.length > maxHistoryLength) {
          fpsHistory.shift();
        }

        // Calculate moving average
        const averageFps = fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length;

        if (averageFps < 30 && isLowEnd) {
          console.warn(`[Performance Engine] Low average frame rate detected (${averageFps.toFixed(1)} FPS) on low-end hardware. Triggering auto-pocket/ultra-perf-mode.`);
          setActivePreset("pocket");
        }

        // Reset counters for next 1s sample
        frameCount = 0;
        sampleStartTime = now;
      }
      rafId = requestAnimationFrame(measure);
    };

    rafId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rafId);
  }, [mode]);

  // Apply setting class to body for global CSS selectors (transitions, blurs, etc.)
  useEffect(() => {
    const body = document.body;
    if (activePreset === "pocket") {
      body.classList.add("ultra-perf-mode");
      body.classList.remove("high-perf-mode");
    } else {
      body.classList.add("high-perf-mode");
      body.classList.remove("ultra-perf-mode");
    }
  }, [activePreset]);

  const setMode = (newMode: PerformanceMode) => {
    localStorage.setItem("almox_perf_mode", newMode);
    setModeState(newMode);
  };

  return {
    mode,
    activePreset,
    setMode,
    isPocket: activePreset === "pocket"
  };
}
