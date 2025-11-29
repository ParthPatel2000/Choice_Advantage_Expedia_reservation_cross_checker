// ===============================
// MEMORY
// ===============================
let confirmations = {};
let confirmationQueue = [];
let currentIndex = 0;
let botRunning = false;

function saveState() {
    chrome.storage.local.set({
        SW_STATE: {
            botRunning,
            confirmations,
            confirmationQueue,
            currentIndex
        }
    });
}

chrome.storage.local.get("SW_STATE", (data) => {
    if (!data.SW_STATE) return;

    botRunning = data.SW_STATE.botRunning || false;
    confirmations = data.SW_STATE.confirmations || {};
    confirmationQueue = data.SW_STATE.confirmationQueue || [];
    currentIndex = data.SW_STATE.currentIndex || 0;

    console.log("Restored state from storage:", data.SW_STATE);
});



// ===============================
// LISTEN FOR POPUP EVENTS
// ===============================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // Load confirmations
    if (msg.type === "SAVE_CONFIRMATIONS") {
        confirmations = msg.payload;
        confirmationQueue = Object.keys(confirmations);
        currentIndex = 0;

        saveState(); // <-- persist
        chrome.storage.local.set({ CHOICE_RESULTS: confirmations }, () => {
            console.log("Saved confirmations to chrome.storage.local");
        });

        console.log("Loaded confirmations:", confirmations);
        sendResponse({ ok: true });
    }

    // START BOT
    if (msg.type === "START_BOT") {
        console.log("STARTing Bot message received");
        botRunning = true;

        saveState(); // <-- persist
    }

    // STOP BOT
    if (msg.type === "STOP_BOT") {
        console.log("Stopping Bot message received");
        botRunning = false;

        saveState(); // <-- persist
    }

    if (msg.type === "GET_STATUS") {
        sendResponse({ running: botRunning });
    }

    // Reservation status returned
    if (msg.type === "CHOICE_STATUS_RESULT") {
        console.log("Received CA status:", msg.status);

        const conf = confirmationQueue[currentIndex];

        if (confirmations[conf]) {
            confirmations[conf].choiceStatus = msg.status || "UNKNOWN";
            confirmations[conf].choice_arrival = msg.choice_arrival || null;
            confirmations[conf].choice_departure = msg.choice_departure || null;

            chrome.storage.local.set({ CHOICE_RESULTS: confirmations }, () => {
                console.log("Saved confirmations to chrome.storage.local");
            });
        } else {
            console.warn("Confirmation not found:", conf);
        }

        console.log("Updated confirmation object:", confirmations[conf]);

        // Move pointer
        currentIndex++;

        saveState(); // <-- persist after updating info and index

        // Finished all
        if (currentIndex >= confirmationQueue.length) {
            console.log("All confirmations processed.");
            console.log("Stopping Bot...");
            botRunning = false;

            chrome.storage.local.set({ CHOICE_RESULTS: confirmations }, () => {
                console.log("Saved confirmations to chrome.storage.local");
            });

            confirmations = {};
            confirmationQueue = [];
            currentIndex = 0;

            saveState(); // <-- persist clear state

            return;
        }

        // Reload init page to continue
        chrome.tabs.update(sender.tab.id, {
            url: "https://www.choiceadvantage.com/choicehotels/FindReservationInitialize.init"
        });
    }


    // Popup requests results
    if (msg.type === "GET_RESULTS") {
        let results = Object.keys(confirmations).length ? confirmations : {};

        if (!Object.keys(results).length) {
            chrome.storage.local.get("CHOICE_RESULTS", (data) => {
                if (data.CHOICE_RESULTS) results = data.CHOICE_RESULTS;
                sendResponse({ confirmations: results });
                console.log("Sending Cached Results.");
            });
            return true;
        }

        sendResponse({ confirmations: results });
        return true;
    }
});


// ===============================
// TAB UPDATED → INJECT SCRIPTS
// ===============================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!botRunning) return;
    if (changeInfo.status !== "complete") return;
    if (!tab.url) return;

    // SEARCH PAGE
    if (tab.url.includes("FindReservationInitialize.init")) {
        console.log("Injecting confirmationNumberSearch.js");

        chrome.scripting.executeScript({
            target: { tabId },
            files: ["scripts/confirmatioNumberSearch.js"]
        }, () => {
            console.log("confirmatioNumberSearch.js injected");
            sendNextConfirmation(tabId);
        });
    }

    // RESULTS PAGE
    if (tab.url.includes("FindReservation.do")) {
        console.log("Injecting findReservationStatus.js");

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
        console.log("No more confirmations.");
        return;
    }

    const conf = confirmationQueue[currentIndex];
    console.log("Sending confirmation:", conf);

    chrome.tabs.sendMessage(tabId, {
        type: "SEARCH_CONFIRMATION",
        confirmation: conf
    });
}
