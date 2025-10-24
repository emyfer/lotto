var express = require('express')
var router = express.Router()
const {Client} = require('pg')

//za napravit:

//  ako postoji samo ispisati aktivne listice za to kolo
//      i omoguciti unos novih
//  ako ne postoji prikazati zadnje izvucene brojeve i 
//      listice za to kolo
//prikazati listice koji odgovaraju samo nickname osobi
//spremiti nove listice u bazu
//izgenerirati qr kod i napraviti stranicu gdje ce se oni citati

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

con.query('Select * from "tickets"', (err, res) => {
    if(!err) {
        //console.log(res.rows)
        // OVO NE RADI tickets = res.rows
    } else {
        console.log(err.message)
    }
    con.end;
})


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
    //console.log("active:")
    //console.log(active_kolo)
    //console.log("Active kolo broj:", active_kolo.broj_kola);

    isActive = false


    if (req.oidc.isAuthenticated() && req.oidc.user) {
        const nickname = req.oidc.user.nickname;
        //console.log("postoji user")

        if (active_kolo) {
                // postoji aktivno kolo
            //console.log("postoji aktivno")
            
            isActive = true;
            const tRes = await con.query(
                `SELECT * FROM tickets WHERE nickname = $1 AND broj_kola = $2;`,
                [nickname, active_kolo.broj_kola]
            );
            tickets = tRes.rows;
            //console.log("postoje ticketi za marko22 za aktivno kolo")
            //console.log(tickets)
        } else if (lastClosed) {
                // nema aktivnog kola – dohvaćamo listiće iz zadnjeg zatvorenog kola
            const tRes = await con.query(
                `SELECT * FROM tickets WHERE nickname = $1 AND broj_kola = $2;`,
                [nickname, lastClosed.broj_kola]
            );
            tickets = tRes.rows;
        }
    }


    //console.log(req.oidc.isAuthenticated())
    //console.log(req.oidc.user)
    res.render('index', {
        title: "Lotto", 
        isAuthenticated: req.oidc.isAuthenticated(),
        user: req.oidc.user,
        isActive: isActive,
        array: tickets
    })
})

let uuid = null


router.get("/uplata", (req, res) => {
    if(req.oidc.isAuthenticated) {
        res.render('uplata', {
        })

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
    console.log("UUID novog listića:", uuid);

    //console.log(`Novi listić spremljen za ${nickname}:`);
    //console.log({kolo: active_kolo.broj_kola, numbers });   
    res.redirect("/")

});


module.exports = router