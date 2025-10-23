const express = require('express');
const app = express();
const path = require('path');
const {Client} = require('pg')
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

app.use(express.urlencoded({
    extended: true
}));

const con = new Client({
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "postgres",
    database: "web_labosi"
})
con.connect().then(() => console.log("connected"))

app.use(auth(config));

var indexRouter = require("./routes/index.js")
app.use("/", indexRouter)

con.query('Select * from "tickets"', (err, res) => {
    if(!err) {
        console.log(res.rows)
    } else {
        console.log(err.message)
    }
    con.end;
})

app.listen(3000, () => {
    console.log(`Example app listening on port 3000`)
})

