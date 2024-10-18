document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById("time-form");
    const settingsButton = document.getElementById("settings-button");
    const settingsModal = document.getElementById("settings-modal");
    const closeModal = document.querySelector(".close");
    const settingsForm = document.getElementById("settings-form");

    // Load default settings from local storage
    const defaultWorkHours = localStorage.getItem("workHours") || 7.6;
    const defaultBreakHours = localStorage.getItem("breakHours") || 0.5;

    document.getElementById("work-hours").value = defaultWorkHours;
    document.getElementById("break-hours").value = defaultBreakHours;

    form.addEventListener("submit", function(event) {
        event.preventDefault();
        
        const startTime = document.getElementById("start-time").value;
        const workHours = parseFloat(document.getElementById("work-hours").value);
        const breakHours = parseFloat(document.getElementById("break-hours").value);
        const endTime = document.getElementById("end-time").value;

        if (!startTime) {
            alert("Bitte geben Sie eine gültige Startzeit ein.");
            return;
        }

        const startTimeDate = new Date(`1970-01-01T${startTime}:00`);
        const optimalEndTime = new Date(startTimeDate.getTime() + (workHours + breakHours) * 60 * 60 * 1000);
        
        document.getElementById("optimal-end").textContent = `Ende: ${optimalEndTime.toTimeString().substring(0, 5)}`;

        if (endTime) {
            const actualEndTimeDate = new Date(`1970-01-01T${endTime}:00`);
            const actualWorkTime = (actualEndTimeDate - startTimeDate) / (60 * 60 * 1000) - breakHours;
            const saldo = actualWorkTime - workHours;
            document.getElementById("saldo").textContent = `Saldo: ${saldo.toFixed(1)} h`;
        } else {
            document.getElementById("saldo").textContent = "Kein tatsächliches Ende angegeben.";
        }
    });

    // Open settings modal
    settingsButton.addEventListener("click", function() {
        document.getElementById("default-work-hours").value = defaultWorkHours;
        document.getElementById("default-break-hours").value = defaultBreakHours;
        settingsModal.style.display = "block";
    });

    // Close settings modal
    closeModal.addEventListener("click", function() {
        settingsModal.style.display = "none";
    });

    // Save settings
    settingsForm.addEventListener("submit", function(event) {
        event.preventDefault();
        const newWorkHours = document.getElementById("default-work-hours").value;
        const newBreakHours = document.getElementById("default-break-hours").value;

        localStorage.setItem("workHours", newWorkHours);
        localStorage.setItem("breakHours", newBreakHours);

        alert("Einstellungen gespeichert!");

        settingsModal.style.display = "none";
    });
});
