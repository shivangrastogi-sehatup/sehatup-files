require('dotenv').config();

(async () => {
    const url = process.env.DEFAULT_GSCRIPT_URL;
    if (!url) {
        console.error("ERROR: DEFAULT_GSCRIPT_URL is not set in .env");
        return;
    }

    const payload = {
        phone: "9876543210",
        updatedBy: "Scratch Test Script",
        updates: {
            "First Name": "Dummy",
            "Last Name": "TestEntry",
            "Phone Number": "9876543210",
            "Address": "42 MG Road, Block C",
            "Landmark": "Near Apollo Hospital",
            "District/City": "New Delhi",
            "State": "Delhi",
            "Pin Code": "110001"
        }
    };

    console.log("Posting to:", url);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload),
            redirect: "follow"
        });

        console.log("\nStatus:", res.status);
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch error:", e.message);
    }
})();
