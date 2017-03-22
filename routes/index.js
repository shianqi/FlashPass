let express = require('express');
let router = express.Router();

let FlashPass = require('./flashPass');

/* GET home page. */
router.get('/', function(req, res, next) {
	if(FlashPass.loggedIn(req)){
		res.render('index', { title: 'Express' });
	}else{
		res.redirect('/users/login');
	}
});

module.exports = router;
