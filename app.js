const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const nodemailer = require("nodemailer");

const app = express();
const PORT = 3000;

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Path to the CSV file
const csvPath = "./data/fraud_data.csv";

// Load fraud data from CSV
let fraudData = [];
fs.createReadStream(csvPath)
  .pipe(csv())
  .on("data", (row) => {
    fraudData.push(row);
  })
  .on("end", () => {
    console.log("CSV file successfully loaded.");
  })
  .on("error", (err) => {
    console.error("Error reading CSV file:", err);
  });

// Serve the form (index page)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Endpoint to check transactions
app.post("/check-transaction", (req, res) => {
  const { customerID, creditCardNumber, transactionAmount, country } = req.body;

  // Validate input fields
  if (!customerID || !creditCardNumber || !transactionAmount || !country) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  // Find customer data based on Customer ID and Credit Card Number
  const customerData = fraudData.find(
    (data) =>
      data["Customer ID"] === customerID &&
      data["Credit Card Number"] === creditCardNumber
  );

  if (!customerData) {
    return res.status(404).json({ message: "Customer or Credit Card not found." });
  }

  const averageTransactionAmount = parseFloat(
    customerData["Average Transaction Amount"]
  );
  const customerCountry = customerData["native-country"].replace(/b'|'/g, "");

  // Fraud detection rules
  if (
    transactionAmount > averageTransactionAmount * 3 ||
    country !== customerCountry
  ) {
    // Fraud detected
    console.log("Fraudulent transaction detected:", req.body);
    
    // Send email notification for fraud
    sendFraudEmail(req.body);
    
    // Send fraud response to the client directly
    return res.status(403).send(`
      <h1>Fraud Transaction Detected</h1>
      <p>Transaction details:</p>
      <pre>${JSON.stringify(req.body, null, 2)}</pre>
    `);
  }

  // Transaction is valid, redirect to /completed
  console.log("Transaction completed:", req.body);
  res.redirect("/completed");
});

// Endpoint for completed transaction
app.get("/completed", (req, res) => {
  res.send('<h1>Transaction Successful. Thank you!</h1>');
});

// Send fraud notification email
function sendFraudEmail(transactionDetails) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "Your Email",
      pass: "Password", 
    },
  });

  const mailOptions = {
    from: "Sender Email",
    to: "Receiver Email",
    subject: "Fraud Transaction Detected",
    text: `Fraudulent transaction detected. Here are the details:\n\n${JSON.stringify(
      transactionDetails,
      null,
      2
    )}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
    } else {
      console.log("Fraud notification sent: " + info.response);
    }
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
