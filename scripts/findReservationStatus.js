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
        console.log("CA Reservation Status:", statusText);

        // Send status back to background
        chrome.runtime.sendMessage({
            type: "CHOICE_STATUS_RESULT",
            status: statusText
        });

        console.log("Status sent back to background");

    } catch (err) {
        console.error("Error getting status:", err);

        chrome.runtime.sendMessage({
            type: "CHOICE_STATUS_RESULT",
            status: null,
            error: err.toString()
        });
    }
})();
