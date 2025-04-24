document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("time-form");
    const settingsButton = document.getElementById("settings-button");
    const settingsModal = document.getElementById("settings-modal");
    const closeModal = document.querySelector(".close");
    const settingsForm = document.getElementById("settings-form");

    const defaultWorkHours = localStorage.getItem("workHours") || 7.6;
    document.getElementById("work-hours").value = defaultWorkHours;

    // Berechnet gesetzlich vorgeschriebene Pausenzeit
    function getLegalBreakTime(workDuration) {
        if (workDuration > 9) {
            return 0.75; // 45 Minuten
        } else if (workDuration > 6) {
            return 0.5; // 30 Minuten
        } else {
            return 0; // Keine gesetzliche Pause nötig
        }
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const startTime = document.getElementById("start-time").value;
        const workHours = parseFloat(document.getElementById("work-hours").value);
        const endTime = document.getElementById("end-time").value;

        if (!startTime) {
            alert("Bitte geben Sie eine gültige Startzeit ein.");
            return;
        }

        const startTimeDate = new Date(`1970-01-01T${startTime}:00`);

        let breakHours, actualEndTimeDate, actualWorkDuration;

        if (endTime) {
            actualEndTimeDate = new Date(`1970-01-01T${endTime}:00`);
            actualWorkDuration = (actualEndTimeDate - startTimeDate) / (60 * 60 * 1000);
            breakHours = getLegalBreakTime(actualWorkDuration);
        } else {
            breakHours = getLegalBreakTime(workHours);
        }

        document.getElementById("break-hours").value = breakHours;

        // Optimaler Feierabend
        const optimalEndTime = new Date(startTimeDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000);
        document.getElementById("optimal-end").textContent = `Ende: ${optimalEndTime.toTimeString().substring(0, 5)}`;

        if (endTime) {
            const actualWorkTime = actualWorkDuration - breakHours;
            const saldo = actualWorkTime - workHours;
            document.getElementById("saldo").textContent = `Saldo: ${saldo.toFixed(1)} h`;
        } else {
            document.getElementById("saldo").textContent = "Kein tatsächliches Ende angegeben.";
        }
    });

    // Einstellungen
    settingsButton.addEventListener("click", function () {
        document.getElementById("default-work-hours").value = defaultWorkHours;
        settingsModal.style.display = "block";
    });

    closeModal.addEventListener("click", function () {
        settingsModal.style.display = "none";
    });

    settingsForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const newWorkHours = document.getElementById("default-work-hours").value;
        localStorage.setItem("workHours", newWorkHours);
        alert("Einstellungen gespeichert!");
        settingsModal.style.display = "none";
    });
});
