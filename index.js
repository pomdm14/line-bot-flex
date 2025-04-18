const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const axios = require('axios');
const bodyParser = require('body-parser');

require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// LINE webhook endpoint
app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;

  const results = await Promise.all(events.map(async (event) => {
    if (event.type === 'message' && event.message.type === 'text') {
      const userText = event.message.text;

      try {
        const dialogflowRes = await axios.post(
          \`https://dialogflow.googleapis.com/v2/projects/\${process.env.DIALOGFLOW_PROJECT_ID}/agent/sessions/\${event.source.userId}:detectIntent\`,
          {
            queryInput: {
              text: {
                text: userText,
                languageCode: 'th',
              },
            }
          },
          {
            headers: {
              Authorization: \`Bearer \${process.env.DIALOGFLOW_ACCESS_TOKEN}\`,
            },
          }
        );

        const fulfillment = dialogflowRes.data.queryResult.fulfillmentMessages?.[0];

        // ถ้าเป็น Flex
        if (fulfillment?.payload?.line?.type === 'flex') {
          return client.replyMessage(event.replyToken, fulfillment.payload.line);
        }

        // ตอบข้อความธรรมดา
        const replyText = dialogflowRes.data.queryResult.fulfillmentText || "ขออภัย ฉันไม่เข้าใจคำถาม";
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: replyText,
        });

      } catch (err) {
        console.error("Error calling Dialogflow:", err.message);
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ 🙏',
        });
      }
    }
  }));

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 LINE Flex Relay Bot is running on port", PORT);
});
