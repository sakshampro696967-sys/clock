(function () {
    const TZ = "Asia/Kolkata";
    const GLOW_STORAGE_KEY = "gmtClockGlow";

    const timeEl = document.getElementById("timeDisplay");
    const glowSlider = document.getElementById("glowSlider");
    const glowMinBtn = document.getElementById("glowMinBtn");
    const glowMaxBtn = document.getElementById("glowMaxBtn");

    const prefersReducedGlow =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /** Exponent < 1: glow ramps up faster so small slider moves change the look more */
    const GLOW_CURVE = 0.48;

    function percentToIntensity(percent) {
        const x = Math.max(0, Math.min(1, percent / 100));
        return Math.pow(x, GLOW_CURVE);
    }

    function clampPercent(percent) {
        const n = Number(percent);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(100, Math.round(n * 2) / 2));
    }

    /**
     * @param {number} t - 0..1; at 1, stacks many large blurs for maximum neon bloom
     */
    function glowToTextShadow(t) {
        const intensity = Math.max(0, Math.min(1, t));
        if (intensity < 0.002) {
            return "none";
        }

        const cap = prefersReducedGlow ? 0.72 : 1;
        const u = intensity * cap;
        const shadows = [];

        shadows.push(`0 0 ${(1.5 + 3 * u).toFixed(2)}px rgba(0, 248, 255, ${0.7 + 0.3 * u})`);

        const innerSteps = prefersReducedGlow ? 6 : 12;
        for (let i = 0; i < innerSteps; i++) {
            const blur = (3 + i * 22 * u) * (0.55 + 0.45 * u);
            const a = 0.92 * u * (1 - i / (innerSteps + 3));
            shadows.push(`0 0 ${blur.toFixed(1)}px rgba(0, ${228 - i * 10}, 255, ${a})`);
        }

        const midSteps = prefersReducedGlow ? 4 : 8;
        for (let i = 0; i < midSteps; i++) {
            const blur = (70 + i * 42 * u) * u;
            const a = 0.58 * u * (1 - i / (midSteps + 2));
            shadows.push(`0 0 ${blur.toFixed(1)}px rgba(0, 170, 255, ${a})`);
        }

        const outerSteps = prefersReducedGlow ? 2 : 5;
        for (let i = 0; i < outerSteps; i++) {
            const blur = (180 + i * 90 * u) * u;
            const a = 0.42 * u * (1 - i / (outerSteps + 3));
            shadows.push(`0 0 ${blur.toFixed(1)}px rgba(0, 140, 230, ${a})`);
        }

        if (!prefersReducedGlow && u > 0.75) {
            const x = (u - 0.75) / 0.25;
            shadows.push(`0 0 ${(320 + 180 * x).toFixed(0)}px rgba(0, 200, 255, ${0.38 * x})`);
            shadows.push(`0 0 ${(480 + 260 * x).toFixed(0)}px rgba(0, 120, 220, ${0.26 * x})`);
            shadows.push(`0 0 ${(620 + 300 * x).toFixed(0)}px rgba(40, 80, 200, ${0.16 * x})`);
        }

        return shadows.join(", ");
    }

    function applyGlowFromPercent(percent) {
        const p = clampPercent(percent);
        timeEl.style.textShadow = glowToTextShadow(percentToIntensity(p));
        glowSlider.value = String(p);
        glowSlider.setAttribute("aria-valuenow", String(p));
        try {
            localStorage.setItem(GLOW_STORAGE_KEY, String(p));
        } catch {
            /* ignore */
        }
    }

    function initGlow() {
        let stored = null;
        try {
            stored = localStorage.getItem(GLOW_STORAGE_KEY);
        } catch {
            /* ignore */
        }
        const parsed = stored !== null ? Number.parseFloat(stored) : NaN;
        const initial =
            Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
                ? parsed
                : Number.parseFloat(glowSlider.value);
        applyGlowFromPercent(initial);
    }

    glowSlider.addEventListener("input", () => {
        applyGlowFromPercent(glowSlider.value);
    });

    glowMinBtn.addEventListener("click", () => {
        applyGlowFromPercent(0);
    });

    glowMaxBtn.addEventListener("click", () => {
        applyGlowFromPercent(100);
    });

    initGlow();

    function formatTimeIST(now) {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: TZ,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).formatToParts(now);

        const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
        return `${get("hour")}:${get("minute")}:${get("second")}`;
    }

    let lastBeepMinute = -1;
    let audioContext = null;

    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log("Audio context not supported");
            }
        }
        if (audioContext && audioContext.state === "suspended") {
            audioContext.resume().catch((e) => console.log("Could not resume audio context:", e));
        }
    }

    function playBeep() {
        try {
            initAudioContext();
            if (!audioContext) {
                console.log("Audio context not available");
                return;
            }

            console.log("Playing beep at " + new Date().toLocaleTimeString());
            alert("BEEP! It's 1:50 PM!");

            // Create 10 beeps - MAXIMUM LOUDNESS!
            for (let beepNum = 0; beepNum < 10; beepNum++) {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 1200;
                oscillator.type = "square";

                const startTime = audioContext.currentTime + beepNum * 0.25;
                gainNode.gain.setValueAtTime(1.0, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.1, startTime + 0.2);

                oscillator.start(startTime);
                oscillator.stop(startTime + 0.3);
            }
        } catch (e) {
            console.log("Beep sound could not be played:", e);
        }
    }

    // Test beep function - call this to test immediately
    window.testBeep = function() {
        console.log("TEST BEEP TRIGGERED");
        playBeep();
    };

    // Enable audio on first user interaction
    document.addEventListener("click", initAudioContext, { once: true });
    document.addEventListener("keydown", initAudioContext, { once: true });

    function tick() {
        const now = new Date();
        timeEl.textContent = formatTimeIST(now);

        const isoParts = new Intl.DateTimeFormat("en-CA", {
            timeZone: TZ,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).formatToParts(now);

        const g = (type) => isoParts.find((p) => p.type === type)?.value ?? "";
        const hour = g("hour");
        const minute = g("minute");
        const second = g("second");

        timeEl.setAttribute(
            "datetime",
            `${g("year")}-${g("month")}-${g("day")}T${hour}:${minute}:${second}`,
        );

        // Debug: Log current time
        console.log(`Clock time: ${hour}:${minute}:${second}`);

        // Play beep at 13:50 (1:50 PM) - trigger during first 5 seconds
        const numSecond = parseInt(second, 10);
        if (hour === "13" && minute === "50" && numSecond >= 0 && numSecond <= 5 && lastBeepMinute !== 50) {
            console.log("🔊 BEEP CONDITION MET! Triggering beep...");
            // Flash the screen
            document.body.style.backgroundColor = "#ffff00";
            setTimeout(() => { document.body.style.backgroundColor = ""; }, 200);
            playBeep();
            lastBeepMinute = 50;
        } else if (minute !== "50") {
            lastBeepMinute = -1;
        }
    }

    tick();
    setInterval(tick, 1000);
})();
