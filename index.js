const express = require('express');
const { google } = require('googleapis');
const cookieSession = require('cookie-session');
const fs = require('fs');
const csv = require('csv-parser');
const multer = require('multer');

const app = express();
const port = 3000;

const CLIENT_ID = '495328307028-a3v76mgmhjrom6l47qt36kekfemqv9of.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const sessionSecret = 'my_super_secret_key_123'; 

app.use(cookieSession({
    maxAge: 24 * 60 * 60 * 1000, 
    keys: [sessionSecret] 
}));

const upload = multer({ dest: 'uploads/' }); // Files will be stored in the 'uploads' directory

app.get('/', (req, res) => {
    res.send('<h1>Welcome to Gmail API Project</h1><a href="/auth/google">Authenticate with Google</a>');
});

app.get('/auth/google', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.send'],
    });
    res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        req.session.tokens = tokens; 

        res.send('Authentication successful! You can now upload a CSV file to send emails. <form action="/upload" method="post" enctype="multipart/form-data"><input type="file" name="csvfile" accept=".csv"/><button type="submit">Upload CSV</button></form>');
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.send('Error during authentication. <a href="/">Go back</a>');
    }
});

app.post('/upload', upload.single('csvfile'), async (req, res) => {
    const tokens = req.session.tokens;
    if (!tokens) {
        return res.send('You need to authenticate first. <a href="/">Go back</a>');
    }

    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const recipients = []; 
    const headers = []; 

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
            
            if (row.email) {
                recipients.push(row.email); 
            }
           
            if (headers.length === 0) {
                headers.push(...Object.keys(row)); 
            }
        })
        .on('end', async () => {
            for (const recipient of recipients) {
                const email = [
                    `From: "Sadhika Sahana" <sadhikasahana@gmail.com>`, 
                    `To: ${recipient}`, 
                    `Subject: Test Email from Gmail API`,
                    ``,
                    `Hello, this is a test email sent to ${recipient} using the Gmail API!`
                ].join('\n');

                const base64EncodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

                try {
                    await gmail.users.messages.send({
                        userId: 'me',
                        requestBody: {
                            raw: base64EncodedEmail,
                        },
                    });
                    console.log(`Email sent to: ${recipient}`);
                } catch (error) {
                    console.error(`Error sending email to ${recipient}:`, error);
                }
            }
                        fs.unlinkSync(req.file.path); 
                        res.send('Emails sent successfully! <a href="/">Go back</a>');
                    });
            });
            
            app.listen(port, () => {
                console.log(`Server is running on http://localhost:${port}`);
            });