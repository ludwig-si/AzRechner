document.addEventListener("DOMContentLoaded", function () {
    const entriesContainer = document.getElementById("time-entries");
    const addEntryBtn = document.getElementById("add-entry-btn");
    const template = document.getElementById("entry-template");
    const targetHoursInput = document.getElementById("target-hours");
    const targetHoursDisplay = document.getElementById("target-hours-display");
    const breakAfterSixHours = 360;
    const breakAfterNineHours = 540;
    const requiredBreakAfterSixHours = 30;
    const requiredBreakAfterNineHours = 45;
    const longDayWarningThreshold = 600;

    // Initiale Einstellungen laden
    const savedTarget = localStorage.getItem("targetHours");
    if (savedTarget) targetHoursInput.value = savedTarget;

    addTimeRow();
    calculate();

    // Live-Update jede Minute
    setInterval(calculate, 60000);

    // --- Event Listener ---
    addEntryBtn.addEventListener("click", () => { addTimeRow(); calculate(); });

    targetHoursInput.addEventListener("input", function () {
        localStorage.setItem("targetHours", this.value);
        calculate();
    });

    entriesContainer.addEventListener("input", (e) => {
        if (e.target.classList.contains("time-input")) calculate();
    });

    entriesContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-btn")) {
            if (entriesContainer.children.length > 1) {
                e.target.closest(".time-row").remove();
            } else {
                e.target.closest(".time-row").querySelectorAll("input").forEach(i => i.value = "");
            }
            calculate();
        }
    });

    // --- Helper ---
    function addTimeRow() {
        entriesContainer.appendChild(template.content.cloneNode(true));
    }

    function timeToMinutes(timeStr) {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function minutesToTimeStr(totalMinutes) {
        let mNorm = totalMinutes % 1440;
        if (mNorm < 0) mNorm += 1440;
        const h = Math.floor(mNorm / 60);
        const m = Math.round(mNorm % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    function formatOutput(minutes, showDecimal = true) {
        const sign = minutes < 0 ? "-" : "";
        const absMin = Math.abs(minutes);
        const h = Math.floor(absMin / 60);
        const m = Math.round(absMin % 60);
        const decimal = (minutes / 60).toFixed(2);
        return `${sign}${h}:${m.toString().padStart(2, '0')} h${showDecimal ? ` (${decimal})` : ''}`;
    }

    // --- Hauptberechnung ---
    function calculate() {
        const targetVal = parseFloat(targetHoursInput.value) || 0;
        const targetMinutes = Math.round(targetVal * 60);
        targetHoursDisplay.textContent = formatOutput(targetMinutes, false);

        const rows = document.querySelectorAll(".time-row");
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        let realBlocks = [];
        let forecastBlocks = [];
        let hasOpenBlock = false;

        rows.forEach((row) => {
            const startVal = row.querySelector(".start-input").value;
            const endVal = row.querySelector(".end-input").value;

            if (startVal) {
                let s = timeToMinutes(startVal);
                let e_real = null;
                let e_forecast = null;

                if (endVal) {
                    // Start & Ende gesetzt
                    let e = timeToMinutes(endVal);
                    if (e < s) e += 1440;
                    e_real = e;
                    e_forecast = e;
                } else {
                    // Offenes Ende
                    hasOpenBlock = true;
                    let nowAdjusted = currentMinutes;
                    if (nowAdjusted < s) nowAdjusted += 1440;

                    e_real = nowAdjusted;
                    // Prognose: Open end geht theoretisch bis +24h
                    e_forecast = s + 1440;
                }
                realBlocks.push({ start: s, end: e_real });
                forecastBlocks.push({ start: s, end: e_forecast });
            }
        });

        if (realBlocks.length === 0) {
            resetUI();
            return;
        }

        realBlocks.sort((a, b) => a.start - b.start);
        forecastBlocks.sort((a, b) => a.start - b.start);

        const interBlockBreakMinutes = calculateInterBlockBreakMinutes(realBlocks);
        const optimalEnd = findOptimalEnd(forecastBlocks, targetMinutes);
        renderOptimalEnd(optimalEnd);
        document.getElementById("break-time").textContent = formatOutput(interBlockBreakMinutes, false);

        if (hasOpenBlock) {
            resetWorkResults("-");
            return;
        }

        const result = simulateWorkDay(realBlocks);
        renderWorkResults(result, targetMinutes);
    }

    function calculateInterBlockBreakMinutes(blocks) {
        let totalBreakMinutes = 0;
        for (let i = 0; i < blocks.length - 1; i++) {
            totalBreakMinutes += Math.max(0, blocks[i + 1].start - blocks[i].end);
        }
        return totalBreakMinutes;
    }

    function renderOptimalEnd(optimalEnd) {
        const optEndEl = document.getElementById("optimal-end-time");
        if (optimalEnd.status === "reached") {
            optEndEl.textContent = `${minutesToTimeStr(optimalEnd.minute)} Uhr`;
        } else {
            optEndEl.textContent = "Ziel mit diesen Zeiten nicht erreicht";
        }
    }

    function renderWorkResults(result, targetMinutes) {
        document.getElementById("gross-work").textContent = formatOutput(result.grossPresence);

        const dedEl = document.getElementById("system-deduction");
        dedEl.textContent = `${result.deduction} min`;
        dedEl.style.color = result.deduction > 0 ? "#d35400" : "#777";

        document.getElementById("net-work").textContent = formatOutput(result.netWork);
        document.getElementById("long-day-warning").hidden = result.netWork <= longDayWarningThreshold;

        const saldoMinutes = result.netWork - targetMinutes;
        const saldoEl = document.getElementById("saldo");
        saldoEl.textContent = formatOutput(saldoMinutes);
        saldoEl.className = saldoMinutes >= 0 ? "positive" : "negative";
        if (Math.abs(saldoMinutes) > 0) saldoEl.classList.add("bold", "large");
    }

    function resetWorkResults(deductionText) {
        document.getElementById("gross-work").textContent = "-";
        document.getElementById("system-deduction").textContent = deductionText;
        document.getElementById("net-work").textContent = "-";
        document.getElementById("long-day-warning").hidden = true;
        document.getElementById("saldo").textContent = "-";
        document.getElementById("saldo").className = "";
    }

    /**
     * Simulation: Minute für Minute
     */
    function simulateWorkDay(blocks, stopAtTarget = null) {
        if (blocks.length === 0) return { netWork: 0 };

        const dayStart = blocks[0].start;
        const dayEnd = blocks[blocks.length - 1].end;

        function isPresent(minute) {
            return blocks.some(b => minute >= b.start && minute < b.end);
        }

        // Pausenlücken analysieren (nur >= 15 min sind gültig)
        const validBreakIntervals = [];
        for (let i = 0; i < blocks.length - 1; i++) {
            const gapStart = blocks[i].end;
            const gapEnd = blocks[i + 1].start;
            // Nur wenn die Lücke >= 15 Min ist, gilt sie als Pausenerfüllung
            if ((gapEnd - gapStart) >= 15) {
                validBreakIntervals.push({ start: gapStart, end: gapEnd });
            }
        }
        function isValidBreakTime(minute) {
            return validBreakIntervals.some(i => minute >= i.start && minute < i.end);
        }

        let netWork = 0;
        let recordedBreakMinutes = 0;
        let deductionWithinCurrentThreshold = 0;
        let currentBreakRequirement = 0;
        let deduction = 0;
        let grossPresence = 0;

        for (let m = dayStart; m < dayEnd; m++) {

            // Prognose-Abbruch
            if (stopAtTarget !== null && netWork >= stopAtTarget) {
                return { finishedAt: m };
            }

            const workingNow = isPresent(m);
            if (workingNow) grossPresence++;

            let requiredBreak = 0;
            if (netWork >= breakAfterNineHours) requiredBreak = requiredBreakAfterNineHours;
            else if (netWork >= breakAfterSixHours) requiredBreak = requiredBreakAfterSixHours;

            if (requiredBreak > currentBreakRequirement) {
                currentBreakRequirement = requiredBreak;
                deductionWithinCurrentThreshold = 0;
            }

            if (recordedBreakMinutes + deductionWithinCurrentThreshold < requiredBreak) {
                // --- Zwangspause nötig ---

                if (workingNow) {
                    // User arbeitet, obwohl er Pause machen müsste.
                    // Das System zieht die Zeit ab (Deduction) und wertet sie zwangsweise als Pause.
                    deduction++;
                    deductionWithinCurrentThreshold++;
                } else {
                    // User ist nicht da.
                    // Zählt das als Erfüllung der Zwangspause?
                    // NUR wenn es eine gültige Pause (>= 15min) ist!

                    if (isValidBreakTime(m)) {
                        recordedBreakMinutes++;
                    } else {
                        // User macht eine kurze Pause (<15 min).
                        // Das zählt NICHT zur Erfüllung der gesetzlichen Pflicht.
                        // Der Pausenzähler bleibt stehen.
                        // Das heißt: Wenn er wiederkommt, fordert das System immer noch die Pause ein.
                    }
                }

            } else {
                // --- Alles okay, normale Arbeit ---
                if (workingNow) {
                    netWork++;
                } else {
                    // User ist weg (freiwillige Zusatzpause).
                    // Zählt zum Pausenkonto, falls gültig (für spätere 9h Grenze relevant)
                    if (isValidBreakTime(m)) recordedBreakMinutes++;
                }
            }
        }

        if (stopAtTarget !== null && netWork >= stopAtTarget) {
            return { finishedAt: dayEnd };
        }

        return { netWork, deduction, grossPresence };
    }

    function findOptimalEnd(blocks, targetMinutes) {
        const result = simulateWorkDay(blocks, targetMinutes);
        if (result.finishedAt !== undefined) {
            return { status: "reached", minute: result.finishedAt };
        }
        return { status: "unreachable", minute: null };
    }

    function resetUI() {
        document.getElementById("optimal-end-time").textContent = "--:-- Uhr";
        document.getElementById("break-time").textContent = "0:00 h";
        resetWorkResults("0 min");
    }
});
