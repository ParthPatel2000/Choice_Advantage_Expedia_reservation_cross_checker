// ===============================
// MEMORY
// ===============================
let confirmations = {};        // loaded from popup; each key is confirmation#, value is object
let confirmationQueue = [];    // list of confirmation numbers
let currentIndex = 0;          // pointer

// ===============================
// LISTEN FOR POPUP SENDING CONFIRMATIONS
// ===============================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // From popup → load confirmations and reset
    if (msg.type === "SAVE_CONFIRMATIONS") {
        confirmations = msg.payload;
        confirmationQueue = Object.keys(confirmations);
        currentIndex = 0;

        console.log("Loaded confirmations:", confirmations);

        sendResponse({ ok: true });
    }

    // From FindReservation.do → we have a status result
    if (msg.type === "CHOICE_STATUS_RESULT") {
        console.log("Received CA status:", msg.status);

        const conf = confirmationQueue[currentIndex];

        if (confirmations[conf]) {
            // Add the status field to the original object
            confirmations[conf].choiceStatus = msg.status || "UNKNOWN";

            // Add arrival/departure
            confirmations[conf].choice_arrival = msg.choice_arrival || null;
            confirmations[conf].choice_departure = msg.choice_departure || null;

        } else {
            console.warn("Confirmation not found in object:", conf);
        }

        console.log("Updated confirmation object:", confirmations[conf]);

        // Move to next
        currentIndex++;

        // If finished → stop
        if (currentIndex >= confirmationQueue.length) {
            console.log("All confirmations processed.");
            console.log("Final confirmations with status:", confirmations);

            chrome.storage.local.set({ CHOICE_RESULTS: confirmations }, () => {
                console.log("Saved confirmations to chrome.storage.local");
            });

            //clear in-memory cache to prevent re runs
            confirmations = {};
            confirmationQueue = [];
            currentIndex = 0;

            return;
        }

        // Go back to the init page for the next one
        chrome.tabs.update(sender.tab.id, {
            url: "https://www.choiceadvantage.com/choicehotels/FindReservationInitialize.init"
        });
    }

    if (msg.type === "GET_RESULTS") {
        let results = Object.keys(confirmations).length ? confirmations : {};

        if (!Object.keys(results).length) {
            chrome.storage.local.get("CHOICE_RESULTS", (data) => {
                if (data.CHOICE_RESULTS) results = data.CHOICE_RESULTS;
                sendResponse({ confirmations: results });
                console.log("Sending Cached Results.")
            });
            return true; // required for async response
        }

        sendResponse({ confirmations: results });
        return true;
    }

});


// ===============================
// TAB UPDATED → INJECT CONTENT SCRIPTS
// ===============================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

    if (changeInfo.status !== "complete") return;
    if (!tab.url) return;

    // Inject SEARCH script
    if (tab.url.includes("FindReservationInitialize.init")) {
        console.log("Injecting confirmatioNumberSearch.js on Init");

        chrome.scripting.executeScript({
            target: { tabId },
            files: ["scripts/confirmatioNumberSearch.js"]
        }, () => {
            console.log("confirmatioNumberSearch.js injected");
            sendNextConfirmation(tabId);
        });
    }

    // Inject STATUS script
    if (tab.url.includes("FindReservation.do")) {
        console.log("Injecting findReservationStatus.js on Results page");

        chrome.scripting.executeScript({
            target: { tabId },
            files: ["scripts/findReservationStatus.js"]
        });
    }
});

// ===============================
// SEND CONFIRMATION TO SEARCH SCRIPT
// ===============================
function sendNextConfirmation(tabId) {
    if (currentIndex >= confirmationQueue.length) {
        console.log("No more confirmations to send.");
        return;
    }

    const conf = confirmationQueue[currentIndex];
    console.log("Sending confirmation:", conf);

    chrome.tabs.sendMessage(tabId, {
        type: "SEARCH_CONFIRMATION",
        confirmation: conf
    });
}
