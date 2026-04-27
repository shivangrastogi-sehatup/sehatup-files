const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

/**
 * MOCK DATA for previewing the prescription template
 */
const mockData = {
    date: new Date().toLocaleDateString('en-GB'),
    patientName: "Shivang Rastogi",
    patientGender: "Male",
    patientAge: "25",
    displayId: "RX-1000000000000008",
    diagnosis: "General health checkup with minor symptoms of fatigue and stress. Patient advised to maintain a balanced diet and regular exercise.",
    medications: [
        { sNo: 1, name: "Ashwagandha Tablets", regimen: "As directed", duration: "30 days", remarks: "After dinner" },
        { sNo: 2, name: "Pure Himalayan Shilajit Resin - 20g | SehatUP", regimen: "Qty: 1", duration: "1 month", remarks: "With warm milk" }
    ],
    dietAdvice: [
        "Avoid oily and spicy food",
        "Drink plenty of water (3-4 liters daily)",
        "Include more green leafy vegetables"
    ],
    lifestyleAdvice: [
        "Walk 30 min daily",
        "Maintain a consistent sleep schedule",
        "Practice meditation for 10 minutes"
    ]
};

function generatePreview() {
    const templatePath = path.join(__dirname, 'templates', 'prescriptionTemplate.html');
    const outputPath = path.join(__dirname, 'templates', 'preview_result.html');

    if (!fs.existsSync(templatePath)) {
        console.error("Template not found at:", templatePath);
        return;
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    const html = template(mockData);

    fs.writeFileSync(outputPath, html);
    console.log("--------------------------------------------------");
    console.log("Preview generated successfully!");
    console.log("Location:", outputPath);
    console.log("--------------------------------------------------");
    console.log("You can now open the file in your browser to see the style.");
}

generatePreview();
