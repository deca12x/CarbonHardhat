const GIST_ID = "cf2ee6f50ce263010dbcf51e048b1bb2";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const actualRate = 0.0025; // The human-readable rate
const rateDecimals = 6;
// Convert to BigInt to handle large numbers correctly, then to string for JSON
const scaledRateForGist = (BigInt(Math.round(actualRate * Math.pow(10, rateDecimals)))).toString();

const updatedContent = [
  {
    recipientAddress: "0xYourFlareAddress", // Placeholder
    recipientGas: 12345, // Placeholder
    rate: scaledRateForGist, // e.g., "2500000000000000"
  },
];

async function updateGist() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: {
        "gasEmissions.json": {
          content: JSON.stringify(updatedContent, null, 2),
        },
      },
    }),
  });

  if (res.ok) console.log("Gist updated!");
  else console.error("Update failed", await res.text());
}

updateGist();
