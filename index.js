const { PubSub } = require('@google-cloud/pubsub');
const { Sequelize, DataTypes } = require('sequelize');

const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

require('dotenv').config();

const PROJECT_ID = process.env.PROJECT_ID;
const PUBSUB_SUBSCRIPTION =  process.env.PUBSUB_SUBSCRIPTION;
const CLOUDSQL_INSTANCE_CONNECTION_NAME =  process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME;
const DB_NAME =  process.env.DB_NAME;
const DB_USER =  process.env.DB_USER;
const DB_PASS =  process.env.DB_PASS;
const MAILGUN_API_KEY =  process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN =  process.env.MAILGUN_DOMAIN;

const sequelize = new Sequelize({
  dialect: 'mysql',
  dialectOptions: {
    socketPath: `/cloudsql/${CLOUDSQL_INSTANCE_CONNECTION_NAME}`
  },
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASS
});

const mg = mailgun.client({username: 'api', key: process.env.MAILGUN_API_KEY || 'key-yourkeyhere'});
const pubSubClient = new PubSub({ projectId: PROJECT_ID });

async function sendVerificationEmail(event, context) {
  const pubsubMessage = event.data ? Buffer.from(event.data, 'base64').toString() : '{}';
  const { user, verificationToken } = JSON.parse(pubsubMessage);

  try {
    const expirationTime = Date.now() + 2 * 60 * 1000; // 2 minutes
    const verificationLink = `https://yashashree.me/verify-email?token=${verificationToken}&expiration=${expirationTime}`;
    await sendEmail(user.email, verificationLink);

    await sequelize.query('INSERT INTO TrackEmail (email, verification_token, sent_at) VALUES (?, ?)', {
      replacements: [user.email, verificationToken, new Date()]
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
  }
};

async function sendEmail(user, verificationLink) {
  const data = {
    from: 'mailgun@yashashree.me',
    to: user.email,
    subject: 'Verify Your Email Address',
    text: `<p> Find your details below: ${user} </p> < /br> <p> Click on the following link to verify your email address: ${verificationLink} </p>`
  };

  mg.messages().send(data, (error, body) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', body);
    }
  });
};


functions.http('subscribe', (req, res) => {
  const subscription = pubSubClient.subscription(PUBSUB_SUBSCRIPTION);
  subscription.on('message', async message => {
    try {
      await sendVerificationEmail(message, {});
      message.ack();
    } catch (error) {
      console.error('Error processing message:', error);
      message.nack();
    }
  });
});

// async function subscribe() {
//   const subscription = pubSubClient.subscription(PUBSUB_SUBSCRIPTION);
//   subscription.on('message', async message => {
//     try {
//       await exports.sendVerificationEmail(message, {});
//       message.ack();
//     } catch (error) {
//       console.error('Error processing message:', error);
//       message.nack();
//     }
//   });
// };

// subscribe();
