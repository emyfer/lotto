const express = require('express');
const app = express();
const path = require('path');
const port = 3000


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({
    extended: true
}));

app.get("/", (req, res) => {
    res.send("Hello world")
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})