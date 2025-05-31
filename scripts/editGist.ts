const GIST_ID = "cf2ee6f50ce263010dbcf51e048b1bb2";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const updatedContent = [
  {
    recipientAddress: "0xMockAddress",
    recipientGas: 1000,
    rate: 0.0025,
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
