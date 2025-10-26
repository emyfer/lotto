const express = require('express');
const app = express();
const path = require('path');
const { auth } = require('express-openid-connect');
require('dotenv').config()

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASEURL,
  clientID: process.env.CLIENTID,
  issuerBaseURL: process.env.ISSUER
};

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));



app.use(auth(config));

var indexRouter = require("./routes/index.js")
app.use("/", indexRouter)


const externalUrl = process.env.RENDER_EXTERNAL_URL;
const port = 3000;
const hostname = externalUrl ? '0.0.0.0' : 'localhost';

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  if (externalUrl) console.log(`Externally accessible at ${externalUrl}`);
});