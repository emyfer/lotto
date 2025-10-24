var express = require('express')
var router = express.Router()
const {Client} = require('pg')
const QRCode = require('qrcode');

const {requiresAuth} = require('express-openid-connect')

const con = new Client({
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "postgres",
    database: "web_labosi"
})
con.connect().then(() => console.log("connected"))

let isActive = null

router.get("/", async (req,res) => {

    const lastClosed = await con.query(`
            SELECT broj_kola, izvuceni_brojevi
            FROM kolo
            WHERE izvuceni_brojevi IS NOT NULL
            ORDER BY datum_zavrsetka DESC
            LIMIT 1;
        `);

        let last_closed = lastClosed.rows[0]
        //console.log("Last closed:")
        //console.log(last_closed)


    const active = await con.query(`
            SELECT broj_kola, izvuceni_brojevi
            FROM kolo
            WHERE izvuceni_brojevi IS NULL
            ORDER BY datum_zavrsetka DESC
            LIMIT 1;
        `);

    let active_kolo = active.rows[0]
    let tickets = [];

    isActive = false

    if (req.oidc.isAuthenticated() && req.oidc.user) {
        const nickname = req.oidc.user.nickname;

        if (active_kolo) {
            
            isActive = true;
            const tRes = await con.query(
                `SELECT * FROM tickets WHERE nickname = $1 AND broj_kola = $2;`,
                [nickname, active_kolo.broj_kola]
            );
            tickets = tRes.rows;

        } else if (lastClosed) {
            const tRes = await con.query(
                `SELECT * FROM tickets WHERE nickname = $1 AND broj_kola = $2;`,
                [nickname, lastClosed.broj_kola]
            );
            tickets = tRes.rows;
        }
    }

    res.render('index', {
        title: "Lotto 6/45", 
        isAuthenticated: req.oidc.isAuthenticated(),
        user: req.oidc.user,
        isActive: isActive,
        array: tickets
    })
})

let uuid = null

router.get("/uplata", (req, res) => {
    if(req.oidc.isAuthenticated()) {
        res.render('uplata', {
            qrUrl: null
        })
    } else {
        res.send("Nemate pristup stranici")
    }
})

router.post("/uplata", async (req, res) => {
    const { document, numbers } = req.body;

    const activeRes = await con.query(`
            SELECT broj_kola FROM kolo
            WHERE izvuceni_brojevi IS NULL
            ORDER BY datum_zavrsetka DESC
            LIMIT 1;
        `);
    const active_kolo = activeRes.rows[0];

    const nickname = req.oidc.user.nickname;

    const created_at = new Date();

    const result = await con.query(
        `INSERT INTO tickets (broj_kola, nickname, broj_osobne, uplaceni_brojevi, datum_uplate)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [active_kolo.broj_kola, nickname, document, numbers, created_at]
    );

    const newTicket = result.rows[0];
    uuid = newTicket.id;

    const qrData = `${req.protocol}://${req.get('host')}/ticket/${uuid}`;
    const qrCodeDataURL = await QRCode.toDataURL(qrData);

    res.render('uplata', {
            qrUrl: qrCodeDataURL
        })

});

router.get("/ticket/:uuid", async (req, res) => {
    const { uuid } = req.params;

    try {
        const result = await con.query("SELECT * FROM tickets WHERE id = $1;", [uuid]);
        if (result.rows.length === 0) {
            return res.status(404).send("Listić nije pronađen.");
        }

        const ticket = result.rows[0];
        console.log(ticket)
        res.render('qrPrikaz', {
            ticket: ticket
        })


    } catch (err) {
        console.error("Greška pri dohvaćanju listića:", err);
        res.status(500).send("Greška pri dohvaćanju podataka.");
    }
});


module.exports = router