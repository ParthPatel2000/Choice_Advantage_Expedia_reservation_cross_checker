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

        const key = obj["Confirmation #"] || `N${i}`;
        results[key] = {
            name: obj["Guest"],
            checkin: obj["Check-in"],
            checkout: obj["Check-out"],
            confirmation: obj["Confirmation #"],
            paymentType: obj['Payment type'],
            expediaStatus: obj['Status']
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

    // Click handler
    runBotBtn.addEventListener("click", () => {
        // Check current button state to toggle
        if (runBotBtn.textContent.includes("Run")) {
            chrome.runtime.sendMessage({ type: "START_BOT" });

            chrome.tabs.create({
                url: "https://www.choiceadvantage.com/choicehotels/FindReservationInitialize.init"
            }, (tab) => {
                console.log("Bot started on tab:", tab.id);
            });
        } else {
            chrome.runtime.sendMessage({ type: "STOP_BOT" });
        }
    });

    // Function to update button appearance
    function updateButton(running) {
        if (running) {
            runBotBtn.style.backgroundColor = "red";
            runBotBtn.textContent = "Stop Bot";
        } else {
            runBotBtn.style.backgroundColor = "green";
            runBotBtn.textContent = "Run Bot(Check Reservations on Choice)";
        }
    }

    // Poll the background every 500ms
    function pollBotStatus() {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
            if (res && typeof res.running === "boolean") {
                updateButton(res.running);
            }
        });
    }

    // Start polling
    setInterval(pollBotStatus, 500);
});


document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["FILTER_STATUSES"], data => {
        let savedStatuses = data.FILTER_STATUSES;

        // --- FIRST LOAD DEFAULTS ---
        if (!savedStatuses) {
            // all checked as default
            savedStatuses = Array.from(document.querySelectorAll(".statusFilter"))
                .map(cb => cb.value);

            chrome.storage.local.set({ FILTER_STATUSES: savedStatuses });
        }

        // apply to UI
        document.querySelectorAll(".statusFilter").forEach(cb => {
            cb.checked = savedStatuses.includes(cb.value);
        });

        updateNoShowList();
    });
});


document.querySelectorAll(".statusFilter").forEach(cb => {
    cb.addEventListener("change", () => {
        const selected = Array.from(document.querySelectorAll(".statusFilter:checked"))
            .map(x => x.value);

        chrome.storage.local.set({ FILTER_STATUSES: selected });
        updateNoShowList();
    });
});



document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("noShowList");
    const tooltip = document.getElementById("tooltip");


    // -------------------------------------------------
    // Tooltip positioning system
    // -------------------------------------------------
    function attachTooltipListeners() {
        document.querySelectorAll("#noShowList div").forEach(line => {
            line.onmouseenter = null;
            line.onmouseleave = null;

            line.addEventListener("mouseenter", () => {
                tooltip.textContent = line.dataset.tooltip || "";
                tooltip.style.display = "block";

                const rect = line.getBoundingClientRect();
                const tooltipHeight = tooltip.offsetHeight || 150;

                const spaceBelow = window.innerHeight - rect.bottom;
                const showBelow = spaceBelow > tooltipHeight + 10;

                const top = showBelow
                    ? rect.bottom + window.scrollY + 5
                    : rect.top + window.scrollY - tooltipHeight - 5;

                tooltip.style.top = `${top}px`;
                tooltip.style.left = `${rect.left + window.scrollX}px`;
            });

            line.addEventListener("mouseleave", () => {
                tooltip.style.display = "none";
            });
        });
    }


    // -------------------------------------------------
    // Render list from chrome.storage.local (EXPEDIA)
    // -------------------------------------------------
    function updateNoShowList() {
        chrome.storage.local.get("CHOICE_RESULTS", (data) => {
            const reservations = data.CHOICE_RESULTS
                ? Object.values(data.CHOICE_RESULTS)
                : [];

            container.innerHTML = "";

            if (!reservations.length) {
                container.textContent = "No reservations loaded.";
                return;
            }

            const checkedFilters = Array.from(
                document.querySelectorAll(".statusFilter:checked")
            ).map(cb => cb.value);

            const showAll = checkedFilters.includes("All");


            reservations.forEach((res, index) => {
                const status = res.choiceStatus || "";
                const stayChanged =
                    res.checkin !== res.choice_arrival ||
                    res.checkout !== res.choice_departure;

                const allowed =
                    stayChanged ||
                    showAll ||
                    checkedFilters.includes(status);

                if (!allowed) return;

                const line = document.createElement("div");
                line.textContent = `${index + 1} - ${res.name} - ${status}`;

                line.addEventListener("click", () => {
                    console.log("Clicked:", res.name);
                    chrome.runtime.sendMessage({
                        type: "START_SINGLE_SEARCH",
                        confirmation: res.confirmation
                    });
                });


                if (stayChanged) {
                    line.classList.add("stayChangeLine");
                    line.textContent += " - STAY CHANGED";
                }

                // Adding the tool Tip.
                line.dataset.tooltip =
                    `Name: ${res.name}\n` +
                    `Choice Status: ${status}\n` +
                    `Expedia Status: ${res.expediaStatus}\n` +
                    `Original: ${res.checkin} → ${res.checkout}\n` +
                    `Choice: ${res.choice_arrival} → ${res.choice_departure}\n` +
                    `Payment: ${res.paymentType}\n`;


                container.appendChild(line);
            });

            attachTooltipListeners();
        });
    }


    // -------------------------------------------------
    // Initial load
    // -------------------------------------------------
    updateNoShowList();


    // -------------------------------------------------
    // Live update when storage changes
    // -------------------------------------------------
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.CHOICE_RESULTS) {
            updateNoShowList();
        }
    });


    // Optional: update when filters change
    document.querySelectorAll(".statusFilter").forEach(cb => {
        cb.addEventListener("change", updateNoShowList);
    });
});
