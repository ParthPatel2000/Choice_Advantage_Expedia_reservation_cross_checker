document.getElementById("csvFile").addEventListener("change", () => {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput.files[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const csvText = e.target.result;
        const parsed = parseCSV(csvText);
        sendToBackground(parsed);
    };

    reader.readAsText(file);
});


// --- CSV PARSER ---
function parseCSV(csv) {
    const lines = csv.split("\n").map(l => l.replace(/\r/g, ""));
    const header = lines[0].split(",").map(h => h.replace(/"/g, ""));
    const results = {};

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const cols = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
            ?.map(col => col.replace(/^"|"$/g, ""));

        if (!cols) continue;

        const obj = {};
        header.forEach((h, idx) => {
            obj[h] = cols[idx];
        });

        results[obj["Confirmation #"]] = {
            name: obj["Guest"],
            checkin: obj["Check-in"],
            checkout: obj["Check-out"]
        };
    }

    return results;
}

// --- SEND TO BACKGROUND ---
function sendToBackground(confirmations) {
    chrome.runtime.sendMessage({
        type: "SAVE_CONFIRMATIONS",
        payload: confirmations
    }, () => {
        alert("CSV uploaded and processed!");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const runBotBtn = document.getElementById("runBot");
    const noShowList = document.getElementById("noShowList");

    // --- 1) Run Bot Button ---
    runBotBtn.addEventListener("click", async () => {
        // Open Choice Advantage Initialize page in a new tab
        chrome.tabs.create({ url: "https://www.choiceadvantage.com/choicehotels/FindReservationInitialize.init" }, (tab) => {
            console.log("Bot started on tab:", tab.id);
        });
    });

    // --- 2) Populate No-show / Cancelled list ---
    function updateNoShowList() {
        chrome.runtime.sendMessage({ type: "GET_RESULTS" }, (response) => {
            if (!response || !response.confirmations) return;

            // Get all checked filters
            const checkedFilters = Array.from(document.querySelectorAll(".statusFilter:checked"))
                .map(cb => cb.value);
            const showAll = checkedFilters.includes("All");

            const lines = [];

            for (const [conf, data] of Object.entries(response.confirmations)) {
                const status = data.choiceStatus || "";

                // Include line if "All" is checked or status matches a checked filter
                if (showAll || checkedFilters.includes(status)) {
                    lines.push(`${conf} - ${data.name} - ${status}`);
                }
            }

            noShowList.value = lines.join("\n");
        });
    }


    // Update list every 2 seconds so popup reflects live progress
    updateNoShowList();
    setInterval(updateNoShowList, 2000);
});

