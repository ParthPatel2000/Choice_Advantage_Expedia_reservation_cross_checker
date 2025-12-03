// Wait for one of multiple elements to appear
function waitForElement(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const start = performance.now();

        function check() {
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
            }

            if (performance.now() - start >= timeout)
                return reject("Timeout waiting for selectors: " + selectors.join(", "));

            requestAnimationFrame(check);
        }

        check();
    });
}

(async function () {
    console.log("findReservationStatus.js injected");

    try {
        // Wait for either the single reservation page OR multiple reservations page
        const statusEl = await waitForElement([
            "#reservation_summary_status",
            "#viewReservationStatus"
        ], 15000); // 15s timeout

        const statusText = statusEl.textContent.trim();

        function parseChoiceDate(dateStr) {
            // Convert MM/DD/YYYY → YYYY-MM-DD
            const [month, day, year] = dateStr.split("/").map(Number);
            return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }

        // Grab the arrival/departure (pick the first set that exists)
        let choice_arrival = document.querySelector("#view_reservation_arrival")?.textContent.trim()
            || document.querySelector("#reservation_summary_arrivalDate")?.textContent.trim()
            || null;

        choice_arrival = choice_arrival ? parseChoiceDate(choice_arrival) : null;

        let choice_departure = document.querySelector("#view_reservation_departure")?.textContent.trim()
            || document.querySelector("#reservation_summary_departureDate")?.textContent.trim()
            || null;

        choice_departure = choice_departure ? parseChoiceDate(choice_departure) : null;

        console.log("CA Reservation Status:", statusText);
        console.log("Arrival:", choice_arrival, "Departure:", choice_departure);

        // Send status and chosen dates back to background
        chrome.runtime.sendMessage({
            type: "CHOICE_STATUS_RESULT",
            status: statusText,
            choice_arrival,
            choice_departure
        });

        console.log("Status and choice dates sent back to background");

    } catch (err) {
        console.error("Error getting status:", err);

        chrome.runtime.sendMessage({
            type: "CHOICE_STATUS_RESULT",
            status: null,
            choice_arrival: null,
            choice_departure: null,
            error: err.toString()
        });
    }
})();
