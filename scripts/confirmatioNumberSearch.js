// ---------------------------
//  WAIT FOR MESSAGES
// ---------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SEARCH_CONFIRMATION") {
        const confNumber = msg.confirmation;
        console.log("Received confirmation:", confNumber);
        searchByConfirmation(confNumber);
    }
});


// ---------------------------
//  SEARCH FUNCTION
// ---------------------------
function searchByConfirmation(confNumber) {
    const input = document.querySelector("input[name='searchIdentifierNumber']");

    if (!input) {
        console.error("Search field not found on this page.");
        return;
    }

    // Fill the field
    if(confNumber.length === 0) {
        console.error("Confirmation number is empty.");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs.length) return;
        
            chrome.tabs.update(tabs[0].id, {
                url: "https://www.choiceadvantage.com/choicehotels/FindReservationInitialize.init"
            });
        });
        return;
    }
    input.value = confNumber;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // Simulate Enter press
    const enterEvent = new KeyboardEvent("keypress", {
        key: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true
    });

    input.dispatchEvent(enterEvent);

    console.log("Search triggered for:", confNumber);
}
