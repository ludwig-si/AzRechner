document.addEventListener("DOMContentLoaded", function () {
    const entriesContainer = document.getElementById("time-entries");
    const addEntryBtn = document.getElementById("add-entry-btn");
    const template = document.getElementById("entry-template");
    const targetHoursInput = document.getElementById("target-hours");
    const targetHoursDisplay = document.getElementById("target-hours-display");

    // Initiale Einstellungen
    const savedTarget = localStorage.getItem("targetHours");
    if (savedTarget) targetHoursInput.value = savedTarget;
    
    addTimeRow(); // Startzeile
    calculate();  // Initialberechnung

    // --- Event Listener ---
    addEntryBtn.addEventListener("click", () => { addTimeRow(); calculate(); });
    
    targetHoursInput.addEventListener("input", function() {
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
                calculate();
            } else {
                e.target.closest(".time-row").querySelectorAll("input").forEach(i => i.value = "");
                calculate();
            }
        }
    });

    // --- Core Functions ---

    function addTimeRow() {
        entriesContainer.appendChild(template.content.cloneNode(true));
    }

    function timeToMinutes(timeStr) {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function formatOutput(minutes, showDecimal = true) {
        const sign = minutes < 0 ? "-" : "";
        const absMin = Math.abs(minutes);
        const h = Math.floor(absMin / 60);
        const m = Math.round(absMin % 60);
        const decimal = (minutes / 60).toFixed(2);
        return `${sign}${h}:${m.toString().padStart(2, '0')} h${showDecimal ? ` (${decimal})` : ''}`;
    }

    function calculate() {
        // 1. Soll-Zeit
        const targetVal = parseFloat(targetHoursInput.value) || 0;
        const targetMinutes = Math.round(targetVal * 60);
        targetHoursDisplay.textContent = formatOutput(targetMinutes, false);

        // 2. Eingaben parsen
        const rows = document.querySelectorAll(".time-row");
        let blocks = [];
        
        rows.forEach(row => {
            const startVal = row.querySelector(".start-input").value;
            const endVal = row.querySelector(".end-input").value;

            if (startVal && endVal) {
                let s = timeToMinutes(startVal);
                let e = timeToMinutes(endVal);
                // Mitternachtsproblem:
                if (e < s) e += 1440; 
                blocks.push({ start: s, end: e });
            }
        });

        if (blocks.length === 0) {
            resetUI();
            return;
        }

        // Sortieren
        blocks.sort((a, b) => a.start - b.start);

        // 3. SIMULATION STARTEN
        const result = simulateWorkDay(blocks);

        // 4. Saldo
        const saldoMinutes = result.netWork - targetMinutes;

        // 5. UI Updates
        document.getElementById("gross-presence").textContent = formatOutput(result.grossPresence);
        document.getElementById("recognized-break").textContent = `${result.breakAccumulator} min`;
        
        const dedEl = document.getElementById("system-deduction");
        dedEl.textContent = `${result.deduction} min`;
        dedEl.style.color = result.deduction > 0 ? "#d35400" : "#27ae60";

        document.getElementById("net-work").textContent = formatOutput(result.netWork);
        
        const saldoEl = document.getElementById("saldo");
        saldoEl.textContent = formatOutput(saldoMinutes);
        saldoEl.className = saldoMinutes >= 0 ? "positive" : "negative";
        if (Math.abs(saldoMinutes) > 0) saldoEl.classList.add("bold", "large");
    }

    /**
     * Die Herzstück-Logik: Minutenweise Simulation
     */
    function simulateWorkDay(blocks) {
        // Tag-Bereich bestimmen
        const dayStart = blocks[0].start;
        // Wir simulieren bis zum letzten Gehen
        const dayEnd = blocks[blocks.length - 1].end;

        // Helper: Ist Nutzer in dieser Minute anwesend?
        function isPresent(minute) {
            return blocks.some(b => minute >= b.start && minute < b.end);
        }

        // Helper: Befindet sich Minute in einer "gültigen" Pause (>= 15min)?
        // Wir analysieren Lücken VOR der Simulation.
        const validBreakIntervals = [];
        for (let i = 0; i < blocks.length - 1; i++) {
            const gapStart = blocks[i].end;
            const gapEnd = blocks[i+1].start;
            const duration = gapEnd - gapStart;
            if (duration >= 15) {
                validBreakIntervals.push({ start: gapStart, end: gapEnd });
            }
        }

        function isValidBreakTime(minute) {
            return validBreakIntervals.some(i => minute >= i.start && minute < i.end);
        }

        // Zähler
        let netWork = 0;
        let breakAccumulator = 0; // Wie viel Pause wurde schon angerechnet?
        let deduction = 0; // Abzug durch Zwangspause während Anwesenheit
        let grossPresence = 0;

        // Wir laufen jede Minute ab
        for (let m = dayStart; m < dayEnd; m++) {
            const workingNow = isPresent(m);
            
            if (workingNow) grossPresence++;

            // Prüfen: Müssen wir Pause erzwingen?
            let requiredBreak = 0;
            if (netWork >= 540) requiredBreak = 45; // nach 9 Std -> 45 Min
            else if (netWork >= 360) requiredBreak = 30; // nach 6 Std -> 30 Min

            // Haben wir genug Pause?
            if (breakAccumulator < requiredBreak) {
                // --- ZWANGSPAUSEN-MODUS (Uhr steht) ---
                
                // Wir füllen den Pausentopf auf, egal was der User macht
                breakAccumulator++;

                if (workingNow) {
                    // User ist da, obwohl er Pause machen müsste -> Abzug
                    deduction++;
                } else {
                    // User ist weg -> alles gut, er macht seine Zwangspause
                }

            } else {
                // --- NORMALER ARBEITS-MODUS (Uhr läuft) ---
                
                if (workingNow) {
                    netWork++;
                } else {
                    // User ist weg. Zählt das als Pause für spätere Limits?
                    // Nur wenn die Lücke >= 15 min ist.
                    if (isValidBreakTime(m)) {
                        breakAccumulator++;
                    }
                }
            }
        }

        return {
            netWork,
            deduction,
            grossPresence,
            breakAccumulator
        };
    }

    function resetUI() {
        document.getElementById("gross-presence").textContent = "-";
        document.getElementById("recognized-break").textContent = "-";
        document.getElementById("system-deduction").textContent = "0 min";
        document.getElementById("net-work").textContent = "-";
        document.getElementById("saldo").textContent = "-";
        document.getElementById("saldo").className = "";
    }
});
