var express = require('express')
var router = express.Router()
const {requiresAuth} = require('express-openid-connect')

 const tickets = [
        { kolo: 1, numbers: "3, 15, 22, 28, 36, 44" },
        { kolo: 1, numbers: "5, 9, 12, 19, 33, 41" },
        { kolo: 2, numbers: "7, 8, 17, 25, 34, 45" }
    ];


router.get("/", (req,res) => {
    console.log(req.oidc.isAuthenticated())
    res.render('index', {
        title: "Lotto", 
        isAuthenticated: req.oidc.isAuthenticated(),
        user: req.oidc.user,
        array: tickets
    })
})

router.get("/uplata", (req, res) => {
    res.render('uplata')
})

router.post("/tickets", (req, res) => {
    const { document, numbers } = req.body;

    console.log("Primljen ticket:");
    console.log(" - Broj osobne/putovnice:", document);
    console.log(" - Brojevi:", numbers);

    tickets.push({kolo: 2 , numbers });

    // Vrati korisnika na početnu da vidi novi unos
    res.redirect("/");
});


module.exports = router