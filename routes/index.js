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

    let errors = [];

    // Provjera osobne
    if (!document || document.trim().length === 0) {
        errors.push("Broj osobne iskaznice ili putovnice ne smije biti prazan.");
    } else if (document.length > 20) {
        errors.push("Broj osobne iskaznice ili putovnice ne smije biti duži od 20 znakova.");
    }

    // Pretvori string u niz brojeva
    const numberArray = numbers
        .split(",")
        .map(n => parseInt(n.trim()))
        .filter(n => !isNaN(n));

    // Provjera količine brojeva
    if (numberArray.length < 6 || numberArray.length > 10) {
        errors.push("Moraš unijeti između 6 i 10 brojeva.");
    }

    // Provjera raspona (1–45)
    if (numberArray.some(n => n < 1 || n > 45)) {
        errors.push("Svi brojevi moraju biti između 1 i 45.");
    }

    // Provjera duplikata
    const unique = new Set(numberArray);
    if (unique.size !== numberArray.length) {
        errors.push("Ne smije biti duplikata među brojevima.");
    }

    // Ako postoji greška, ponovno prikaži formu s porukom
    if (errors.length > 0) {
        return res.render("uplata", {
            qrUrl: null,
            errors,
            document,
            numbers
        });
    }

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

        const koloResult = await con.query("SELECT * FROM kolo WHERE broj_kola = $1;", [ticket.broj_kola]);
        const kolo = koloResult.rows.length > 0 ? koloResult.rows[0] : null;

        res.render('qrPrikaz', {
            ticket: ticket,
            kolo: kolo
        })


    } catch (err) {
        console.error("Greška pri dohvaćanju listića:", err);
        res.status(500).send("Greška pri dohvaćanju podataka.");
    }
});


module.exports = router