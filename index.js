const { Sequelize } = require('sequelize');

const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);

require('dotenv').config();

const CLOUDSQL_INSTANCE_CONNECTION_NAME = process.env.CLOUDSQL_INSTANCE_CONNECTION_NAME;
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

const sequelize = new Sequelize({
  dialect: 'mysql',
  dialectOptions: {
    socketPath: `/cloudsql/${CLOUDSQL_INSTANCE_CONNECTION_NAME}`
  },
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASS
});

const mg = mailgun.client({ username: 'api', key: MAILGUN_API_KEY });

exports.sendVerificationLink = async (event, context) => {
  const pubsubMessage = event.data ? Buffer.from(event.data, 'base64').toString() : '{}';
  const { user, verificationToken } = JSON.parse(pubsubMessage);

  try {
    const verificationLink = `http://${MAILGUN_DOMAIN}:3000/v1/user/verify-email?token=${verificationToken}&email=${user.email}`;
    await sendEmail(user, verificationLink);

    await sequelize.query('INSERT INTO TrackEmails (user_id, email, verification_token, sent_at) VALUES (?, ?, ?, ?)', {
      replacements: [user.id, user.email, verificationToken, new Date()]
    }).catch(error => {
      console.error('Error inserting into TrackEmails table:', error);
    });

  } catch (error) {
    console.error('Error sending verification email:', error);
  }
};

const sendEmail = async (user, verificationLink) => {
  const data = {
    from: 'mailgun@yashashree.me',
    to: user.email,
    subject: 'Verify Your Email Address',
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email Address</title>
      <style>
        body {
          font-family: sans-serif;
          margin: 0;
          padding: 0;
        }
        p {
          margin: 10px 0;
        }
        a {
          color: #333;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <h1>Welcome, ${user.first_name}!</h1>
      <p>Thank you for signing up with our service.</p>
      <p>To complete your registration, please click on the following link to verify your email address:</p>
      <p><a href="${verificationLink}"> Verify your email here </a></p>
      <p>Once you verify your email address, you will be able to access other APIs.</p>
    </body>
    </html>
  `
  };

  mg.messages.create(MAILGUN_DOMAIN, data)
    .then(msg => console.log("Message sent:", msg)) // Success handler
    .catch(err => console.error("Error sending message:", err)); // Error handler
};
