// // import 'dotenv/config';
// import http from 'node:http';
// import { URL } from 'node:url';
// import { google } from 'googleapis';
// import crypto from 'node:crypto';

// const clientId = '662797803022-lmqou5mde8ust3q2lf6u8uf1d5vsuelv.apps.googleusercontent.com';
// const clientSecret = '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';
// const redirectUri = 'http://localhost:3000/oauth2callback';

// if (!clientId) {
//   throw new Error('Missing GOOGLE_OAUTH_CLIENT_ID');
// }

// if (!clientSecret) {
//   throw new Error('Missing GOOGLE_OAUTH_CLIENT_SECRET');
// }

// if (!redirectUri) {
//   throw new Error('Missing GOOGLE_OAUTH_REDIRECT_URI');
// }

// const oauth2Client = new google.auth.OAuth2(
//   clientId,
//   clientSecret,
//   redirectUri,
// );

// const scopes = [
//   'https://www.googleapis.com/auth/drive.file',
// ];

// const state = crypto.randomBytes(32).toString('hex');

// const authorizationUrl = oauth2Client.generateAuthUrl({
//   access_type: 'offline',
//   prompt: 'consent',
//   scope: scopes,
//   include_granted_scopes: true,
//   state,
// });

// console.log('\nOpen this URL in your browser:\n');
// console.log(authorizationUrl);
// console.log('\nWaiting for OAuth callback...\n');

// const redirect = new URL(redirectUri);

// const server = http.createServer(async (req, res) => {
//   try {
//     if (!req.url) {
//       res.writeHead(400);
//       res.end('Missing request URL');
//       return;
//     }

//     const requestUrl = new URL(req.url, redirect.origin);

//     if (requestUrl.pathname !== redirect.pathname) {
//       res.writeHead(404);
//       res.end('Not found');
//       return;
//     }

//     const error = requestUrl.searchParams.get('error');

//     if (error) {
//       res.writeHead(400, {
//         'Content-Type': 'text/plain; charset=utf-8',
//       });

//       res.end(`OAuth error: ${error}`);
//       server.close();
//       return;
//     }

//     const returnedState = requestUrl.searchParams.get('state');

//     if (returnedState !== state) {
//       res.writeHead(400, {
//         'Content-Type': 'text/plain; charset=utf-8',
//       });

//       res.end('Invalid OAuth state');
//       server.close();
//       return;
//     }

//     const code = requestUrl.searchParams.get('code');

//     if (!code) {
//       res.writeHead(400, {
//         'Content-Type': 'text/plain; charset=utf-8',
//       });

//       res.end('Missing authorization code');
//       server.close();
//       return;
//     }

//     const { tokens } = await oauth2Client.getToken(code);

//     console.log('\nOAuth completed successfully.\n');

//     console.log({
//       hasAccessToken: Boolean(tokens.access_token),
//       hasRefreshToken: Boolean(tokens.refresh_token),
//       scope: tokens.scope,
//     });

//     if (!tokens.refresh_token) {
//       console.error(
//         '\nNo refresh token was returned. Revoke the existing app permission and authorize again.\n',
//       );
//     } else {
//       console.log('\nREFRESH TOKEN:\n');
//       console.log(tokens.refresh_token);
//       console.log('\nStore this value securely in your environment.\n');
//     }

//     res.writeHead(200, {
//       'Content-Type': 'text/html; charset=utf-8',
//     });

//     res.end(`
//       <!doctype html>
//       <html>
//         <body>
//           <h2>WePass Google Drive authorization completed.</h2>
//           <p>You can close this window.</p>
//         </body>
//       </html>
//     `);

//     server.close();
//   } catch (error) {
//     console.error('\nOAuth callback failed:', error);

//     res.writeHead(500, {
//       'Content-Type': 'text/plain; charset=utf-8',
//     });

//     res.end('OAuth callback failed. Check the terminal.');

//     server.close();
//   }
// });

// server.listen(Number(redirect.port || 80), redirect.hostname, () => {
//   console.log(`OAuth callback server listening on ${redirect.origin}`);
// });